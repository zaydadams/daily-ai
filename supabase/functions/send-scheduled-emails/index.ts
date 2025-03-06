import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.33.1';
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { format } from "https://deno.land/std@0.168.0/datetime/mod.ts";
import { Resend } from "npm:resend@2.0.0";

// Verify critical environment variables
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY');
const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
const resendApiKey = Deno.env.get('RESEND_API_KEY');
const fromEmail = 'Writer Expert <shaun@writer.expert>';

// Comprehensive environment variable logging
console.log('Environment Variable Checks:');
console.log('SUPABASE_URL:', supabaseUrl ? 'Present' : 'MISSING');
console.log('SUPABASE_ANON_KEY:', supabaseKey ? 'Present (hidden)' : 'MISSING');
console.log('OPENAI_API_KEY:', openaiApiKey ? 'Present (hidden)' : 'MISSING');
console.log('RESEND_API_KEY:', resendApiKey ? 'Present (hidden)' : 'MISSING');

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
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting send-scheduled-emails function");
    
    // Check if we're forcing a send for specific users
    const { users, forceSendToday } = await req.json().catch(() => ({ users: null, forceSendToday: false }));
    
    let usersToProcess = [];
    const now = new Date();
    
    if (users && Array.isArray(users) && users.length > 0 && forceSendToday) {
      // If specific users are provided AND forceSendToday is true, use them
      console.log(`Processing specific users with forceSendToday: ${users.length}`);
      usersToProcess = users;
    } else {
      // Fetch users who should receive emails now based on their delivery time
      console.log("Fetching users who should receive emails now based on delivery time");
      
      // Get all users with preferences
      const { data: allUsers, error: fetchError } = await supabase
        .from('user_industry_preferences')
        .select('*');
        
      if (fetchError) {
        throw new Error(`Failed to fetch users: ${fetchError.message}`);
      }
      
      console.log(`Found ${allUsers.length} total users with preferences`);
      
      // Enhanced user filtering logic
      usersToProcess = allUsers.filter(user => {
        // Detailed logging for each user's time processing
        console.log(`Processing user ${user.email}:
          - Delivery Time: ${user.delivery_time}
          - Timezone: ${user.timezone}
          - Auto Generate: ${user.auto_generate}`);

        // Skip users with auto-generate disabled
        if (!user.auto_generate) {
          console.log(`Skipping user ${user.email} - auto-generate is disabled`);
          return false;
        }

        // Validate delivery time and timezone
        if (!user.delivery_time || !user.timezone) {
          console.log(`Skipping user ${user.email} - missing delivery time or timezone`);
          return false;
        }

        try {
          // Validate delivery time format
          if (!/^\d{1,2}:\d{2}$/.test(user.delivery_time)) {
            console.error(`Invalid delivery time format for ${user.email}: ${user.delivery_time}`);
            return false;
          }

          // More robust time parsing
          const [hours, minutes] = user.delivery_time.split(':').map(Number);
          
          // Validate hours and minutes
          if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
            console.error(`Invalid time values for ${user.email}: ${hours}:${minutes}`);
            return false;
          }

          // Use Intl.DateTimeFormat for more reliable timezone conversion
          const userLocalTime = new Intl.DateTimeFormat('en-US', {
            timeZone: user.timezone,
            hour: 'numeric',
            minute: 'numeric',
            hour12: false
          }).format(now);

          const [localHour, localMinute] = userLocalTime.split(':').map(Number);

          console.log(`User ${user.email}:
            - Current time in ${user.timezone}: ${userLocalTime}
            - Delivery time: ${user.delivery_time}
            - Parsed local time: ${localHour}:${localMinute}`);

          // Check if current time matches delivery time within 5 minutes
          const hourMatch = localHour === hours;
          const minuteMatch = Math.abs(localMinute - minutes) < 5;

          return hourMatch && minuteMatch;
        } catch (error) {
          console.error(`Timezone processing error for ${user.email}:`, error);
          return false;
        }
      });
      
      console.log(`Found ${usersToProcess.length} users to process based on delivery time`);
    }

    // Track errors for reporting
    const errors = [];
    const successes = [];

    // Process each user
    for (const user of usersToProcess) {
      try {
        console.log(`Processing user: ${user.email}, industry: ${user.industry}`);
        
        // Skip users without auto-generate unless forcing
        if (!user.auto_generate && !forceSendToday) {
          console.log(`Skipping user ${user.email} - auto-generate is disabled`);
          continue;
        }
        
        // Set a default temperature if not provided
        const temperature = user.temperature || 0.7;
        
        // Check if we've already sent an email to this user today
        if (!forceSendToday) {
          const today = format(new Date(), 'yyyy-MM-dd');
          
          const { data: existingEmails, error: emailCheckError } = await supabase
            .from('content_history')
            .select('*')
            .eq('email', user.email)
            .gte('sent_at', today);
            
          if (emailCheckError) {
            console.error(`Error checking sent emails for ${user.email}:`, emailCheckError);
          } else if (existingEmails && existingEmails.length > 0) {
            console.log(`Already sent email to ${user.email} today, skipping`);
            continue;
          }
        }
        
        // Generate 3 different content options for the email
        const contentOptions = [];
        for (let i = 0; i < 3; i++) {
          try {
            const content = await generateContent(user.industry, user.tone_name, temperature);
            contentOptions.push(content);
          } catch (generateError) {
            console.error(`Content generation error for user ${user.email}, attempt ${i + 1}:`, generateError);
            // If generation fails, try again with a lower temperature
            const fallbackContent = await generateContent(user.industry, user.tone_name, 0.5);
            contentOptions.push(fallbackContent);
          }
        }
        
        // Format the email content based on the template with 3 options
        const emailContent = formatEmailContent(contentOptions, user.template, user.tone_name, user.industry);
        
        // Send the email
        await sendEmail(user.email, `Your ${user.industry} Industry Update - 3 Content Options`, emailContent);
        
        // Record the sent email in content_history
        const { error: recordError } = await supabase
          .from('content_history')
          .insert({
            email: user.email,
            industry: user.industry,
            content: contentOptions[0].content,
            template: user.template,
            tone_name: user.tone_name
          });
          
        if (recordError) {
          console.error(`Error recording sent email for ${user.email}:`, recordError);
        }
        
        successes.push(user.email);
        console.log(`Successfully processed user ${user.email}`);
      } catch (error) {
        console.error(`Comprehensive error processing user ${user.email}:`, error);
        errors.push({ 
          email: user.email, 
          error: error.message,
          stack: error.stack 
        });
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        processed: usersToProcess.length,
        successes,
        errors
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error("Catastrophic error in scheduled emails function:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        stack: error.stack 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function generateContent(industry: string, toneName = 'professional', temperature = 0.7) {
  try {
    console.log(`Generating content for industry: ${industry}, tone: ${toneName}, temperature: ${temperature}`);
    
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
    console.error("Comprehensive content generation error:", error);
    throw error;
  }
}

async function sendEmail(to: string, subject: string, htmlContent: string) {
  try {
    console.log(`Attempting to send email to ${to}`);
    console.log(`Resend API Key: ${resendApiKey ? 'Present' : 'MISSING'}`);
    console.log(`From Email: ${fromEmail}`);

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
      console.error('Detailed Resend error:', JSON.stringify(emailResponse?.error, null, 2));
      throw new Error(`Resend error: ${emailResponse?.error?.message || 'Unknown error'}`);
    }
    
    console.log(`Email sent successfully to ${to}`);
    console.log('Resend response:', JSON.stringify(emailResponse, null, 2));
    return emailResponse;
  } catch (error) {
    console.error(`Comprehensive email send error for ${to}:`, error);
    console.error('Error stack:', error.stack);
    throw error;
  }
}

// Existing formatEmailContent function remains the same as in the previous implementation
function formatEmailContent(contentOptions: Array<{ title: string, content: string }>, template = 'bullet-points-style-x-style', tone = 'professional', industry = 'your industry') {
  // [The implementation remains the same as in the previous script]
  // (I'm not repeating the entire function to save space)
}
