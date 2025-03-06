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

// Determine if it's time to send email for a user
function isTimeToSendEmail(user) {
  try {
    // Skip if auto-generate is disabled
    if (!user.auto_generate) {
      detailedLog(`Skipping ${user.email} - auto-generate disabled`);
      return false;
    }

    // Validate delivery time and timezone
    if (!user.delivery_time || !user.timezone) {
      detailedLog(`Skipping ${user.email} - missing delivery time or timezone`);
      return false;
    }

    // Parse delivery time
    const { hours: targetHour, minutes: targetMinute } = parseDeliveryTime(user.delivery_time);

    // Get current time in the user's timezone
    const now = new Date();
    const userLocalTime = new Intl.DateTimeFormat('en-US', {
      timeZone: user.timezone,
      hour: 'numeric',
      minute: 'numeric',
      hour12: false
    }).formatToParts(now);

    // Extract hour and minute
    const hourPart = userLocalTime.find(part => part.type === 'hour');
    const minutePart = userLocalTime.find(part => part.type === 'minute');

    const currentHour = parseInt(hourPart.value);
    const currentMinute = parseInt(minutePart.value);

    // Detailed logging for debugging
    detailedLog(`Email timing check for ${user.email}`, {
      timezone: user.timezone,
      originalDeliveryTime: user.delivery_time,
      parsedTargetTime: { targetHour, targetMinute },
      currentLocalTime: userLocalTime,
      currentHour,
      currentMinute
    });

    // Check if current time exactly matches delivery time
    const hourMatch = currentHour === targetHour;
    const minuteMatch = currentMinute === targetMinute;

    return hourMatch && minuteMatch;
  } catch (error) {
    detailedLog(`Time check error for ${user.email}`, error);
    return false;
  }
}

// Function to generate content (same as previous implementation)
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
    detailedLog('Starting scheduled email process');

    // Fetch all users with preferences
    const { data: users, error: fetchError } = await supabase
      .from('user_industry_preferences')
      .select('*');

    if (fetchError) {
      throw new Error(`Failed to fetch users: ${fetchError.message}`);
    }

    detailedLog(`Fetched ${users.length} total users`);

    // Filter users ready to receive emails
    const usersToProcess = users.filter(isTimeToSendEmail);

    detailedLog(`${usersToProcess.length} users ready to receive emails`);

    // Process each user
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

        // Format email content (using previous implementation)
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

        // Record sent email in history
        const { error: historyError } = await supabase
          .from('content_history')
          .insert({
            email: user.email,
            industry: user.industry,
            content: contentOptions[0].content,
            template: user.template,
            tone_name: user.tone_name
          });

        if (historyError) {
          detailedLog(`Error recording email history for ${user.email}`, historyError);
        }
      } catch (userError) {
        detailedLog(`Error processing user ${user.email}`, userError);
      }
    }

    // Return success response
    return new Response(
      JSON.stringify({ 
        success: true, 
        processed: usersToProcess.length 
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

// Existing formatContentAsHtml function (unchanged from previous implementation)
function formatContentAsHtml(contentOptions, industry, template) {
  const today = new Date();
  const formattedDate = today.toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  // [Rest of the HTML template remains the same as in previous implementation]
  return `...`; // Full HTML template would be here
}
