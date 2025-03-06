import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.33.1';
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

// Logging utility
function logger(message: string, ...args: any[]) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`, ...args);
}

// Error logging utility
function errorLogger(context: string, error: any) {
  logger(`ERROR in ${context}:`, {
    message: error.message,
    name: error.name,
    stack: error.stack
  });
}

// Verify environment variables
function validateEnvironmentVariables() {
  const requiredVars = [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'OPENAI_API_KEY',
    'RESEND_API_KEY'
  ];

  requiredVars.forEach(varName => {
    if (!Deno.env.get(varName)) {
      throw new Error(`Missing environment variable: ${varName}`);
    }
  });

  logger('All required environment variables are present');
}

// Initialize environment variables
validateEnvironmentVariables();

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
const openaiApiKey = Deno.env.get('OPENAI_API_KEY')!;
const resendApiKey = Deno.env.get('RESEND_API_KEY')!;

// Initialize clients
const supabase = createClient(supabaseUrl, supabaseKey);
const resend = new Resend(resendApiKey);

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Determine if it's time to send email for a user
function isTimeToSendEmail(user: any): boolean {
  try {
    // Skip if auto-generate is disabled
    if (!user.auto_generate) {
      logger(`Skipping ${user.email} - auto-generate disabled`);
      return false;
    }

    // Validate delivery time and timezone
    if (!user.delivery_time || !user.timezone) {
      logger(`Skipping ${user.email} - missing delivery time or timezone`);
      return false;
    }

    // Parse delivery time
    const [targetHours, targetMinutes] = user.delivery_time.split(':').map(Number);

    // Get current time in user's timezone
    const now = new Date();
    const userLocalTime = new Intl.DateTimeFormat('en-US', {
      timeZone: user.timezone,
      hour: 'numeric',
      minute: 'numeric',
      hour12: false
    }).format(now);

    const [currentHour, currentMinute] = userLocalTime.split(':').map(Number);

    // Check if current time matches delivery time within 5 minutes
    const hourMatch = currentHour === targetHours;
    const minuteMatch = Math.abs(currentMinute - targetMinutes) < 5;

    logger(`Email timing check for ${user.email}:`, {
      timezone: user.timezone,
      deliveryTime: user.delivery_time,
      currentTime: userLocalTime,
      hourMatch,
      minuteMatch
    });

    return hourMatch && minuteMatch;
  } catch (error) {
    errorLogger(`Time check error for ${user.email}`, error);
    return false;
  }
}

// Generate content for email
async function generateContent(industry: string, toneName = 'professional', temperature = 0.7) {
  try {
    logger(`Generating content for ${industry} industry`);

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
    
    // Extract title and content
    const lines = generatedText.split('\n').filter(line => line.trim());
    let title = lines[0];
    let content = lines.slice(1).join('\n');
    
    // Fallback title if needed
    if (title.length > 100 || !title.trim()) {
      title = `${industry} Industry Insight`;
      content = generatedText;
    }
    
    // Clean up title
    title = title.replace(/^#+\s+/, '').replace(/^\*\*|\*\*$/g, '');
    
    return {
      title,
      content,
      snippet: generatedText.substring(0, 300) + (generatedText.length > 300 ? '...' : '')
    };
  } catch (error) {
    errorLogger('Content generation error', error);
    throw error;
  }
}

// Send email function
async function sendEmail(to: string, subject: string, htmlContent: string) {
  try {
    logger(`Sending email to ${to}`);

    const emailResponse = await resend.emails.send({
      from: 'Writer Expert <shaun@writer.expert>',
      to: [to],
      subject: subject,
      html: htmlContent,
      reply_to: "shaun@writer.expert"
    });
    
    if (!emailResponse || emailResponse.error) {
      throw new Error(`Resend error: ${emailResponse?.error?.message || 'Unknown error'}`);
    }
    
    logger(`Email sent successfully to ${to}`);
    return emailResponse;
  } catch (error) {
    errorLogger(`Email send error for ${to}`, error);
    throw error;
  }
}

// Format email content
function formatEmailContent(contentOptions: Array<{ title: string, content: string }>, template = 'bullet-points-style-x-style', tone = 'professional', industry = 'your industry') {
  const today = new Date();
  const formattedDate = today.toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  // Basic HTML email template
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
      
      <p>Generated with a ${tone} tone</p>
    </body>
    </html>
  `;
}

// Main serve function
serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logger('Starting scheduled email process');

    // Fetch all users with preferences
    const { data: users, error: fetchError } = await supabase
      .from('user_industry_preferences')
      .select('*');

    if (fetchError) {
      throw new Error(`Failed to fetch users: ${fetchError.message}`);
    }

    logger(`Fetched ${users.length} total users`);

    // Filter users ready to receive emails
    const usersToProcess = users.filter(isTimeToSendEmail);

    logger(`${usersToProcess.length} users ready to receive emails`);

    // Process each user
    for (const user of usersToProcess) {
      try {
        logger(`Processing user: ${user.email}`);

        // Generate content options
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
        const emailContent = formatEmailContent(
          contentOptions, 
          user.template, 
          user.tone_name, 
          user.industry
        );

        // Send email
        await sendEmail(
          user.email, 
          `Your ${user.industry} Industry Update`, 
          emailContent
        );

        // Record sent email in history
        await supabase
          .from('content_history')
          .insert({
            email: user.email,
            industry: user.industry,
            content: contentOptions[0].content,
            template: user.template,
            tone_name: user.tone_name
          });

        logger(`Successfully processed ${user.email}`);
      } catch (userError) {
        errorLogger(`Error processing user ${user.email}`, userError);
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
    errorLogger('Global error in email scheduling', globalError);

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
