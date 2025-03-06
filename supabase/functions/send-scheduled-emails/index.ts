import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Environment variables
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');

// Initialize clients
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const resend = new Resend(RESEND_API_KEY);

// Detailed logging function
function detailedLog(message: string, data?: any) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`, data ? JSON.stringify(data, null, 2) : '');
}

// Parse delivery time (handle HH:MM:SS format)
function parseDeliveryTime(timeString: string) {
  // Split the time and take only hours and minutes
  const [hours, minutes] = timeString.split(':').map(Number);
  return { hours, minutes };
}

// Improved function to determine if it's time to send email for a user
// Uses a 5-minute window instead of requiring exact time match
function isTimeToSendEmail(user) {
  try {
    // Skip if auto-generate is disabled
    if (!user.auto_generate) {
      detailedLog(`Skipping ${user.email} - auto-generate disabled`);
      return false;
    }

    // Validate delivery time and timezone
    if (!user.delivery_time || !user.timezone) {
      detailedLog(`Skipping ${user.email} - missing delivery time or timezone: ${JSON.stringify({ 
        delivery_time: user.delivery_time, 
        timezone: user.timezone 
      })}`);
      return false;
    }

    // Parse delivery time
    const { hours: targetHour, minutes: targetMinute } = parseDeliveryTime(user.delivery_time);

    // Get current time in the user's timezone
    const now = new Date();
    let userLocalTime;
    try {
      userLocalTime = new Intl.DateTimeFormat('en-US', {
        timeZone: user.timezone,
        hour: 'numeric',
        minute: 'numeric',
        hour12: false
      }).formatToParts(now);
    } catch (tzError) {
      detailedLog(`Invalid timezone for ${user.email}: ${user.timezone}`, tzError);
      return false;
    }

    // Extract hour and minute
    const hourPart = userLocalTime.find(part => part.type === 'hour');
    const minutePart = userLocalTime.find(part => part.type === 'minute');

    if (!hourPart || !minutePart) {
      detailedLog(`Could not parse local time for ${user.email}`, userLocalTime);
      return false;
    }

    const currentHour = parseInt(hourPart.value);
    const currentMinute = parseInt(minutePart.value);

    // Detailed logging for debugging
    detailedLog(`Email timing check for ${user.email}`, {
      timezone: user.timezone,
      originalDeliveryTime: user.delivery_time,
      parsedTargetTime: { targetHour, targetMinute },
      currentLocalTime: { hour: currentHour, minute: currentMinute },
      fullLocalTime: userLocalTime
    });

    // Use a 5-minute window for matching instead of requiring exact time match
    // This allows for scheduling imprecision and edge function execution timing
    const hourMatch = currentHour === targetHour;
    const minuteWithinRange = Math.abs(currentMinute - targetMinute) <= 2; // 5-minute window (±2 minutes)

    const shouldSend = hourMatch && minuteWithinRange;
    
    // Additional logging for debug
    if (hourMatch && Math.abs(currentMinute - targetMinute) <= 5) {
      detailedLog(`Near delivery window for ${user.email}: ${shouldSend ? 'SENDING' : 'NOT SENDING'}`, {
        targetTime: `${targetHour}:${targetMinute}`,
        currentTime: `${currentHour}:${currentMinute}`,
        minuteDifference: Math.abs(currentMinute - targetMinute)
      });
    }

    return shouldSend;
  } catch (error) {
    detailedLog(`Time check error for ${user.email}`, error);
    return false;
  }
}

// Function to generate content
async function generateContent(industry, toneName = 'professional', temperature = 0.7) {
  try {
    detailedLog(`Generating content for industry: ${industry}, tone: ${toneName}`);
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an expert content creator specializing in the ${industry} industry. Create content in a ${toneName} tone.`
          },
          {
            role: 'user',
            content: `Generate a concise, engaging post about an important insight or trend in the ${industry} industry. The content should be in a ${toneName} tone and suitable for professional social media.`
          }
        ],
        temperature: temperature,
      }),
    });

    if (!response.ok) {
      const result = await response.json();
      throw new Error(`OpenAI API error: ${result.error?.message || result.message || response.statusText}`);
    }

    const json = await response.json();
    const generatedText = json.choices[0].message.content.trim();
    
    // Extract a title and content
    const lines = generatedText.split('\n').filter(line => line.trim());
    let title = lines[0];
    let content = lines.slice(1).join('\n');
    
    // If the first line doesn't look like a title, generate one
    if (title.length > 100 || !title.trim()) {
      title = `${industry} Industry Insight`;
      content = generatedText;
    }
    
    // Clean up title if it has markdown-style headers
    title = title.replace(/^#+\s+/, '').replace(/^\*\*|\*\*$/g, '');

    return {
      title,
      content,
      snippet: generatedText.substring(0, 300) + (generatedText.length > 300 ? '...' : '')
    };
  } catch (error) {
    detailedLog("Error generating content", error);
    throw error;
  }
}

// Main serve function for scheduled emails
serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify environment variables are set
    if (!OPENAI_API_KEY || !RESEND_API_KEY || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
      const missingVars = [
        !OPENAI_API_KEY ? 'OPENAI_API_KEY' : null,
        !RESEND_API_KEY ? 'RESEND_API_KEY' : null,
        !SUPABASE_URL ? 'SUPABASE_URL' : null,
        !SUPABASE_ANON_KEY ? 'SUPABASE_ANON_KEY' : null
      ].filter(Boolean);
      
      detailedLog(`Missing environment variables: ${missingVars.join(', ')}`);
      throw new Error(`Missing environment variables: ${missingVars.join(', ')}`);
    }

    detailedLog('Starting scheduled email process');

    // Fetch all users with preferences
    const { data: users, error: fetchError } = await supabase
      .from('user_industry_preferences')
      .select('*');

    if (fetchError) {
      throw new Error(`Failed to fetch users: ${fetchError.message}`);
    }

    if (!users || users.length === 0) {
      detailedLog('No users found in database');
      return new Response(
        JSON.stringify({ success: true, message: 'No users found to process' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    detailedLog(`Fetched ${users.length} total users`);

    // Log some data about all users (with email partially obscured for privacy)
    const userSummary = users.map(u => ({
      email: u.email ? `${u.email.substring(0, 3)}...${u.email.substring(u.email.indexOf('@'))}` : 'missing',
      auto_generate: u.auto_generate,
      has_delivery_time: !!u.delivery_time,
      has_timezone: !!u.timezone,
      industry: u.industry
    }));
    detailedLog('User summary:', userSummary);

    // Filter users ready to receive emails
    const usersToProcess = users.filter(isTimeToSendEmail);

    detailedLog(`${usersToProcess.length} users ready to receive emails`);
    
    if (usersToProcess.length === 0) {
      detailedLog('No users found in the current delivery window');
      return new Response(
        JSON.stringify({ success: true, message: 'No users in current delivery window' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Process each user
    const results = [];
    for (const user of usersToProcess) {
      try {
        detailedLog(`Processing user: ${user.email}`, {
          industry: user.industry,
          timezone: user.timezone,
          deliveryTime: user.delivery_time
        });

        // Generate 3 content options
        const contentOptions = [];
        for (let i = 0; i < 3; i++) {
          const content = await generateContent(
            user.industry, 
            user.tone_name || 'professional', 
            user.temperature || 0.7
          );
          contentOptions.push(content);
          // Small delay between API calls to avoid rate limiting
          if (i < 2) await new Promise(r => setTimeout(r, 500));
        }

        // Format email content
        const htmlContent = formatContentAsHtml(
          contentOptions, 
          user.industry, 
          user.template
        );

        // Send email
        const response = await resend.emails.send({
          from: 'Writer Expert <shaun@writer.expert>',
          to: [user.email],
          subject: `Your ${user.industry} Content Update - 3 Content Options`,
          html: htmlContent,
          reply_to: "shaun@writer.expert"
        });

        detailedLog(`Email sent successfully to ${user.email}`, response);
        results.push({ email: user.email, status: 'success', id: response.id });

        // Prepare content history payload
        const contentHistoryPayload = {
          email: user.email,
          user_id: user.user_id, // Assuming user_id is already in the user_industry_preferences table
          industry: user.industry,
          template: user.template,
          content: contentOptions[0].content,
          sent_at: new Date().toISOString(),
          tone_name: user.tone_name
        };

        // Insert content history
        const { error: historyError, data: insertedData } = await supabase
          .from('content_history')
          .insert(contentHistoryPayload);

        if (historyError) {
          detailedLog(`Error inserting content history for ${user.email}`, {
            error: historyError,
            payload: contentHistoryPayload
          });
        } else {
          detailedLog(`Successfully inserted content history for ${user.email}`, insertedData);
        }
      } catch (userError) {
        detailedLog(`Error processing user ${user.email}`, userError);
        results.push({ email: user.email, status: 'error', message: userError.message });
      }
    }

    // Return success response
    return new Response(
      JSON.stringify({ 
        success: true, 
        processed: usersToProcess.length,
        results
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  } catch (globalError) {
    detailedLog('Global error in scheduled emails', globalError);

    return new Response(
      JSON.stringify({ 
        error: globalError.message 
      }),
      { 
        status: 500, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  }
});

// Format content as HTML email
function formatContentAsHtml(contentOptions, industry, template) {
  const today = new Date();
  const formattedDate = today.toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  // Basic template for emails
  const basicTemplate = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${industry} Industry Update</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        h1 {
          color: #2c3e50;
          border-bottom: 2px solid #eee;
          padding-bottom: 10px;
        }
        h2 {
          color: #3498db;
          margin-top: 25px;
        }
        .content-option {
          margin-bottom: 30px;
          padding: 15px;
          background-color: #f9f9f9;
          border-left: 4px solid #3498db;
        }
        .footer {
          margin-top: 30px;
          padding-top: 15px;
          border-top: 1px solid #eee;
          font-size: 0.9em;
          color: #7f8c8d;
        }
      </style>
    </head>
    <body>
      <h1>${industry} Industry Update - ${formattedDate}</h1>
      
      ${contentOptions.map((content, index) => `
        <div class="content-option">
          <h2>Option ${index + 1}: ${content.title}</h2>
          <p>${content.content.replace(/\n/g, '<br>')}</p>
        </div>
      `).join('')}
      
      <div class="footer">
        <p>Generated by Writer Expert for your ${industry} content needs.</p>
        <p>Questions or feedback? Reply directly to this email.</p>
      </div>
    </body>
    </html>
  `;

  // Use custom template if provided, otherwise use basic template
  return template || basicTemplate;
}
