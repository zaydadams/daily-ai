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
  const [hours, minutes] = timeString.split(':').map(Number);
  return { hours, minutes };
}

// Determine if it's time to send email for a user
function isTimeToSendEmail(user) {
  try {
    if (!user.auto_generate) {
      detailedLog(`Skipping ${user.email} - auto-generate disabled`);
      return false;
    }
    if (!user.delivery_time || !user.timezone) {
      detailedLog(`Skipping ${user.email} - missing delivery time or timezone`);
      return false;
    }

    // Parse user's desired delivery time
    const { hours: targetHour, minutes: targetMinute } = parseDeliveryTime(user.delivery_time);

    // Get current time in the user's timezone
    const now = new Date();
    const userLocalTime = new Intl.DateTimeFormat('en-US', {
      timeZone: user.timezone,
      hour: 'numeric',
      minute: 'numeric',
      hour12: false
    }).formatToParts(now);

    const currentHour = parseInt(userLocalTime.find(part => part.type === 'hour').value);
    const currentMinute = parseInt(userLocalTime.find(part => part.type === 'minute').value);

    detailedLog(`Email timing check for ${user.email}`, {
      timezone: user.timezone,
      originalDeliveryTime: user.delivery_time,
      parsedTargetTime: { targetHour, targetMinute },
      currentLocalTime: userLocalTime,
      currentHour,
      currentMinute
    });

    return currentHour === targetHour && currentMinute === targetMinute;
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
      throw new Error(`OpenAI API error: ${result.error?.message || result.message}`);
    }

    const json = await response.json();
    const generatedText = json.choices[0].message.content.trim();
    
    // Extract title and content
    const lines = generatedText.split('\n').filter(line => line.trim());
    let title = lines[0];
    let content = lines.slice(1).join('\n');
    
    if (title.length > 100 || !title.trim()) {
      title = `${industry} Industry Insight`;
      content = generatedText;
    }
    
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
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    detailedLog('Starting scheduled email process');

    const { data: users, error: fetchError } = await supabase
      .from('user_industry_preferences')
      .select('*');

    if (fetchError) {
      throw new Error(`Failed to fetch users: ${fetchError.message}`);
    }

    detailedLog(`Fetched ${users.length} total users`);

    const usersToProcess = users.filter(isTimeToSendEmail);
    detailedLog(`${usersToProcess.length} users ready to receive emails`);

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
        }

        // Format email content
        const htmlContent = formatContentAsHtml(
          contentOptions, 
          user.industry, 
          user.template
        );

        // *** Compute the scheduled send time ***
        // Get current time in Johannesburg timezone
        const nowJHBString = new Date().toLocaleString("en-US", { timeZone: "Africa/Johannesburg" });
        const nowJHB = new Date(nowJHBString);
        // Create a date set to today at 15:05 in Johannesburg time
        const scheduledTimeJHB = new Date(nowJHB);
        scheduledTimeJHB.setHours(15, 5, 0, 0);
        // If current time in Johannesburg is already past 15:05, schedule for tomorrow
        if (nowJHB > scheduledTimeJHB) {
          scheduledTimeJHB.setDate(scheduledTimeJHB.getDate() + 1);
        }
        const testScheduledTime = scheduledTimeJHB.toISOString();

        detailedLog(`Scheduling email for ${user.email} at ${testScheduledTime} (Johannesburg time)`);

        // Send email with scheduled time using Resend's send_at field
        const response = await resend.emails.send({
          from: 'Writer Expert <shaun@writer.expert>',
          to: [user.email],
          subject: `Your ${user.industry} Content Update - 3 Content Options`,
          html: htmlContent,
          reply_to: "shaun@writer.expert",
          send_at: testScheduledTime
        });

        detailedLog(`Email scheduled successfully for ${user.email}`, response);

        // Prepare content history payload
        const contentHistoryPayload = {
          email: user.email,
          user_id: user.user_id,
          industry: user.industry,
          template: user.template,
          content: contentOptions[0].content,
          sent_at: new Date().toISOString(),
          tone_name: user.tone_name
        };

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
      }
    }

    return new Response(
      JSON.stringify({ success: true, processed: usersToProcess.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (globalError) {
    detailedLog('Global error in scheduled emails', globalError);
    return new Response(
      JSON.stringify({ error: globalError.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>${industry} Industry Update</title>
    </head>
    <body>
      <h1>${industry} Industry Update - ${formattedDate}</h1>
      
      ${contentOptions.map((content, index) => `
        <div>
          <h2>Option ${index + 1}: ${content.title}</h2>
          <p>${content.content}</p>
        </div>
      `).join('')}
      
      <p>Best regards,<br/>Your Content Team</p>
    </body>
    </html>
  `;
}
