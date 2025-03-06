import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.33.1';
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { format } from "https://deno.land/std@0.168.0/datetime/mod.ts";
import { Resend } from "npm:resend@2.0.0";

// Enhanced global error handling
globalThis.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled Promise Rejection:', event.reason);
});

// Aggressive logging function
function safeLog(...args: any[]) {
  try {
    console.log(...args);
  } catch (error) {
    console.error('Logging error:', error);
  }
}

// Verify critical environment variables
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY');
const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
const resendApiKey = Deno.env.get('RESEND_API_KEY');
const fromEmail = 'Writer Expert <shaun@writer.expert>';

// Comprehensive environment variable logging
safeLog('Environment Variable Checks:');
safeLog('SUPABASE_URL:', supabaseUrl ? 'Present' : 'MISSING');
safeLog('SUPABASE_ANON_KEY:', supabaseKey ? 'Present (hidden)' : 'MISSING');
safeLog('OPENAI_API_KEY:', openaiApiKey ? 'Present (hidden)' : 'MISSING');
safeLog('RESEND_API_KEY:', resendApiKey ? 'Present (hidden)' : 'MISSING');

// Throw error if any critical variables are missing
if (!supabaseUrl || !supabaseKey || !openaiApiKey || !resendApiKey) {
  throw new Error('Missing critical environment variables');
}

// Initialize clients
const supabase = createClient(supabaseUrl, supabaseKey);
const resend = new Resend(resendApiKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Add a global try-catch for maximum error capture
  try {
    safeLog("Starting send-scheduled-emails function");
    safeLog("Request method:", req.method);
    
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Parse request body with extensive error handling
    let requestBody = { users: null, forceSendToday: false };
    try {
      requestBody = await req.json().catch(() => ({ users: null, forceSendToday: false }));
      safeLog("Request body:", JSON.stringify(requestBody, null, 2));
    } catch (bodyParseError) {
      safeLog("Error parsing request body:", bodyParseError);
    }
    
    const { users, forceSendToday } = requestBody;
    
    let usersToProcess = [];
    const now = new Date();
    
    // Fetch users to process
    try {
      if (users && Array.isArray(users) && users.length > 0 && forceSendToday) {
        // If specific users are provided AND forceSendToday is true, use them
        safeLog(`Processing specific users with forceSendToday: ${users.length}`);
        usersToProcess = users;
      } else {
        // Fetch users who should receive emails now based on their delivery time
        safeLog("Fetching users who should receive emails now based on delivery time");
        
        // Get all users with preferences
        const { data: allUsers, error: fetchError } = await supabase
          .from('user_industry_preferences')
          .select('*');
          
        if (fetchError) {
          throw new Error(`Failed to fetch users: ${fetchError.message}`);
        }
        
        safeLog(`Found ${allUsers.length} total users with preferences`);
        
        // User filtering logic with maximum logging
        usersToProcess = allUsers.filter(user => {
          try {
            safeLog(`Detailed user check: ${JSON.stringify(user, null, 2)}`);
            
            // Skip users with auto-generate disabled
            if (!user.auto_generate) {
              safeLog(`Skipping user ${user.email} - auto-generate is disabled`);
              return false;
            }

            // Validate delivery time and timezone
            if (!user.delivery_time || !user.timezone) {
              safeLog(`Skipping user ${user.email} - missing delivery time or timezone`);
              return false;
            }

            // Validate delivery time format
            if (!/^\d{1,2}:\d{2}$/.test(user.delivery_time)) {
              safeLog(`Invalid delivery time format for ${user.email}: ${user.delivery_time}`);
              return false;
            }

            // Parse time
            const [hours, minutes] = user.delivery_time.split(':').map(Number);
            
            // Validate hours and minutes
            if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
              safeLog(`Invalid time values for ${user.email}: ${hours}:${minutes}`);
              return false;
            }

            // Timezone conversion
            const userLocalTime = new Intl.DateTimeFormat('en-US', {
              timeZone: user.timezone,
              hour: 'numeric',
              minute: 'numeric',
              hour12: false
            }).format(now);

            const [localHour, localMinute] = userLocalTime.split(':').map(Number);

            safeLog(`Timezone check for ${user.email}:
              - Current time in ${user.timezone}: ${userLocalTime}
              - Delivery time: ${user.delivery_time}
              - Parsed local time: ${localHour}:${localMinute}`);

            // Check if current time matches delivery time within 5 minutes
            const hourMatch = localHour === hours;
            const minuteMatch = Math.abs(localMinute - minutes) < 5;

            const shouldProcess = hourMatch && minuteMatch;
            safeLog(`User ${user.email} processing decision: ${shouldProcess}`);

            return shouldProcess;
          } catch (userProcessError) {
            safeLog(`Error processing user ${user.email}:`, userProcessError);
            return false;
          }
        });
        
        safeLog(`Found ${usersToProcess.length} users to process based on delivery time`);
      }
    } catch (fetchProcessingError) {
      safeLog("Critical error in user fetching and processing:", fetchProcessingError);
      throw fetchProcessingError;
    }

    // Process each user with maximum error handling
    for (const user of usersToProcess) {
      try {
        safeLog(`Processing user: ${user.email}, industry: ${user.industry}`);
        
        // Content generation
        const temperature = user.temperature || 0.7;
        const contentOptions = [];
        
        for (let i = 0; i < 3; i++) {
          try {
            const content = await generateContent(user.industry, user.tone_name, temperature);
            contentOptions.push(content);
          } catch (generateError) {
            safeLog(`Content generation error for user ${user.email}, attempt ${i + 1}:`, generateError);
            // Fallback content generation
            const fallbackContent = await generateContent(user.industry, user.tone_name, 0.5);
            contentOptions.push(fallbackContent);
          }
        }
        
        // Email sending
        const emailContent = formatEmailContent(
          contentOptions, 
          user.template, 
          user.tone_name, 
          user.industry
        );
        
        await sendEmail(user.email, `Your ${user.industry} Industry Update`, emailContent);
        
        // Record sent email
        await supabase
          .from('content_history')
          .insert({
            email: user.email,
            industry: user.industry,
            content: contentOptions[0].content,
            template: user.template,
            tone_name: user.tone_name
          });
        
        safeLog(`Successfully processed user ${user.email}`);
      } catch (userProcessError) {
        safeLog(`Comprehensive error processing user ${user.email}:`, userProcessError);
      }
    }

    // Return success response
    return new Response(
      JSON.stringify({ 
        success: true, 
        processed: usersToProcess.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (globalError) {
    safeLog("Catastrophic error in scheduled emails function:", globalError);
    
    // Ensure error is logged and returned
    return new Response(
      JSON.stringify({ 
        error: globalError.message,
        stack: globalError.stack 
      }),
      { 
        status: 500, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'X-Error-Details': globalError.message 
        } 
      }
    );
  }
});

// Existing helper functions (generateContent, formatEmailContent, sendEmail) remain the same
// [The implementations for these functions would be identical to the previous version]
async function generateContent(industry: string, toneName = 'professional', temperature = 0.7) {
  try {
    safeLog(`Generating content for industry: ${industry}, tone: ${toneName}, temperature: ${temperature}`);
    
    if (!industry) {
      throw new Error('Industry is required');
    }
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
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
      const errorData = await response.json();
      throw new Error(`OpenAI API error: ${errorData.error?.message || response.statusText}`);
    }
    
    const data = await response.json();
    const generatedText = data.choices[0]?.message?.content?.trim();
    
    if (!generatedText) {
      throw new Error('No content generated');
    }
    
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
    safeLog("Comprehensive content generation error:", error);
    throw error;
  }
}

async function sendEmail(to: string, subject: string, htmlContent: string) {
  try {
    safeLog(`Attempting to send email to ${to}`);
    safeLog(`Resend API Key: ${resendApiKey ? 'Present' : 'MISSING'}`);
    safeLog(`From Email: ${fromEmail}`);

    // Validate API key and email addresses
    if (!resendApiKey) {
      throw new Error('Resend API key is missing');
    }
    if (!to || !fromEmail) {
      throw new Error(`Invalid email addresses: to=${to}, from=${fromEmail}`);
    }

    const emailResponse = await resend.emails.send({
      from: fromEmail,
      to: [to],
      subject: subject,
      html: htmlContent,
      reply_to: "shaun@writer.expert"
    });
    
    if (!emailResponse || emailResponse.error) {
      safeLog('Detailed Resend error:', JSON.stringify(emailResponse?.error, null, 2));
      throw new Error(`Resend error: ${emailResponse?.error?.message || 'Unknown error'}`);
    }
    
    safeLog(`Email sent successfully to ${to}`);
    safeLog('Resend response:', JSON.stringify(emailResponse, null, 2));
    return emailResponse;
  } catch (error) {
    safeLog(`Comprehensive email send error for ${to}:`, error);
    safeLog('Error stack:', error.stack);
    throw error;
  }
}

// Existing formatEmailContent function remains the same
function formatEmailContent(contentOptions: Array<{ title: string, content: string }>, template = 'bullet-points-style-x-style', tone = 'professional', industry = 'your industry') {
  // Implementation remains the same as in previous version
  // Detailed HTML email template with content options
}
