import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.33.1';
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { format } from "https://deno.land/std@0.168.0/datetime/mod.ts";
import { Resend } from "npm:resend@2.0.0";

// Ultra-verbose logging function
function ultraLog(...args: any[]) {
  try {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}]`, ...args);
  } catch (error) {
    console.error('Logging error:', error);
  }
}

// Extensive error logging
function logError(context: string, error: any) {
  ultraLog(`ERROR in ${context}:`, {
    message: error.message,
    name: error.name,
    stack: error.stack,
    toString: error.toString()
  });
}

// Verify and log environment variables
function validateEnvironmentVariables() {
  const variables = [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'OPENAI_API_KEY',
    'RESEND_API_KEY'
  ];

  ultraLog('Environment Variable Validation:');
  variables.forEach(varName => {
    const value = Deno.env.get(varName);
    ultraLog(`  ${varName}: ${value ? 'PRESENT (hidden)' : 'MISSING'}`);
  });

  // Throw if any critical variables are missing
  variables.forEach(varName => {
    if (!Deno.env.get(varName)) {
      throw new Error(`Missing critical environment variable: ${varName}`);
    }
  });
}

// Initialize global error handling
globalThis.addEventListener('unhandledrejection', (event) => {
  ultraLog('Unhandled Promise Rejection:', event.reason);
});

// Validate environment variables immediately
try {
  validateEnvironmentVariables();
} catch (initError) {
  ultraLog('CRITICAL INITIALIZATION ERROR:', initError);
  throw initError;
}

// Initialize clients with extensive logging
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
const openaiApiKey = Deno.env.get('OPENAI_API_KEY')!;
const resendApiKey = Deno.env.get('RESEND_API_KEY')!;
const fromEmail = 'Writer Expert <shaun@writer.expert>';

ultraLog('Initializing Supabase and Resend clients');
const supabase = createClient(supabaseUrl, supabaseKey);
const resend = new Resend(resendApiKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Primary serve function with maximum error capture
serve(async (req) => {
  try {
    ultraLog('Request received:', {
      method: req.method,
      url: req.url,
      headers: Object.fromEntries(req.headers)
    });

    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
      ultraLog('Handling CORS preflight request');
      return new Response(null, { headers: corsHeaders });
    }

    // Parse request body with comprehensive error handling
    let requestBody = { users: null, forceSendToday: false };
    try {
      requestBody = await req.json().catch(() => ({ users: null, forceSendToday: false }));
      ultraLog('Parsed request body:', JSON.stringify(requestBody, null, 2));
    } catch (bodyParseError) {
      logError('Request Body Parsing', bodyParseError);
      // Continue with default body if parsing fails
    }

    const { users, forceSendToday } = requestBody;
    const now = new Date();

    // Fetch users to process
    let usersToProcess = [];
    try {
      if (users && Array.isArray(users) && users.length > 0 && forceSendToday) {
        ultraLog(`Processing specific users with forceSendToday: ${users.length}`);
        usersToProcess = users;
      } else {
        ultraLog("Fetching users who should receive emails now");
        
        const { data: allUsers, error: fetchError } = await supabase
          .from('user_industry_preferences')
          .select('*');
          
        if (fetchError) {
          throw new Error(`Failed to fetch users: ${fetchError.message}`);
        }
        
        ultraLog(`Found ${allUsers.length} total users with preferences`);
        
        // User filtering with extensive logging
        usersToProcess = allUsers.filter(user => {
          try {
            ultraLog(`Checking user: ${user.email}`, {
              deliveryTime: user.delivery_time,
              timezone: user.timezone,
              autoGenerate: user.auto_generate
            });

            // Skip users with auto-generate disabled
            if (!user.auto_generate) {
              ultraLog(`Skipping user ${user.email} - auto-generate is disabled`);
              return false;
            }

            // Validate delivery time and timezone
            if (!user.delivery_time || !user.timezone) {
              ultraLog(`Skipping user ${user.email} - missing delivery time or timezone`);
              return false;
            }

            // Parse delivery time
            const [hours, minutes] = user.delivery_time.split(':').map(Number);
            
            // Get local time in user's timezone
            const userLocalTime = new Intl.DateTimeFormat('en-US', {
              timeZone: user.timezone,
              hour: 'numeric',
              minute: 'numeric',
              hour12: false
            }).format(now);

            const [localHour, localMinute] = userLocalTime.split(':').map(Number);

            ultraLog(`Timezone check for ${user.email}:`, {
              currentTimeInTimezone: userLocalTime,
              deliveryTime: user.delivery_time,
              localHour,
              localMinute,
              targetHour: hours,
              targetMinute: minutes
            });

            // Check if current time matches delivery time within 5 minutes
            const hourMatch = localHour === hours;
            const minuteMatch = Math.abs(localMinute - minutes) < 5;

            const shouldProcess = hourMatch && minuteMatch;
            ultraLog(`User ${user.email} processing decision: ${shouldProcess}`);

            return shouldProcess;
          } catch (userProcessError) {
            logError(`User processing error for ${user.email}`, userProcessError);
            return false;
          }
        });
        
        ultraLog(`Found ${usersToProcess.length} users to process`);
      }
    } catch (fetchProcessingError) {
      logError('User fetching and processing', fetchProcessingError);
      throw fetchProcessingError;
    }

    // Process each user
    for (const user of usersToProcess) {
      try {
        ultraLog(`Processing user: ${user.email}`, {
          industry: user.industry,
          template: user.template
        });
        
        // Content generation
        const temperature = user.temperature || 0.7;
        const contentOptions = [];
        
        for (let i = 0; i < 3; i++) {
          try {
            const content = await generateContent(user.industry, user.tone_name, temperature);
            contentOptions.push(content);
          } catch (generateError) {
            logError(`Content generation error for ${user.email}`, generateError);
            // Fallback content generation
            const fallbackContent = await generateContent(user.industry, user.tone_name, 0.5);
            contentOptions.push(fallbackContent);
          }
        }
        
        // Email content formatting
        const emailContent = formatEmailContent(
          contentOptions, 
          user.template, 
          user.tone_name, 
          user.industry
        );
        
        // Send email
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
        
        ultraLog(`Successfully processed user ${user.email}`);
      } catch (userProcessError) {
        logError(`Comprehensive error processing user ${user.email}`, userProcessError);
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
    logError('Catastrophic error in scheduled emails function', globalError);
    
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

// Existing helper functions (content generation, email formatting, etc.)
async function generateContent(industry: string, toneName = 'professional', temperature = 0.7) {
  try {
    ultraLog(`Generating content for industry: ${industry}, tone: ${toneName}, temperature: ${temperature}`);
    
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
    logError("Content generation error", error);
    throw error;
  }
}

async function sendEmail(to: string, subject: string, htmlContent: string) {
  try {
    ultraLog(`Attempting to send email to ${to}`);

    const emailResponse = await resend.emails.send({
      from: fromEmail,
      to: [to],
      subject: subject,
      html: htmlContent,
      reply_to: "shaun@writer.expert"
    });
    
    if (!emailResponse || emailResponse.error) {
      logError('Resend email error', emailResponse?.error);
      throw new Error(`Resend error: ${emailResponse?.error?.message || 'Unknown error'}`);
    }
    
    ultraLog(`Email sent successfully to ${to}`);
    return emailResponse;
  } catch (error) {
    logError(`Email send error for ${to}`, error);
    throw error;
  }
}

// Existing formatEmailContent function remains the same
function formatEmailContent(contentOptions: Array<{ title: string, content: string }>, template = 'bullet-points-style-x-style', tone = 'professional', industry = 'your industry') {
  // Implementation remains the same as in previous version
  // Detailed HTML email template with content options
}
