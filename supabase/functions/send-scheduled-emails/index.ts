
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.33.1';
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { format } from "https://deno.land/std@0.168.0/datetime/mod.ts";

// Initialize Supabase
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Get API keys from environment variables
const openaiApiKey = Deno.env.get('OPENAI_API_KEY')!;
const mailchimpApiKey = Deno.env.get('MAILCHIMP_API_KEY')!;
const mailchimpServerPrefix = Deno.env.get('MAILCHIMP_SERVER_PREFIX')!;
const mailchimpListId = Deno.env.get('MAILCHIMP_LIST_ID')!;
const fromEmail = Deno.env.get('FROM_EMAIL') || 'noreply@example.com';

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
    // Check if required environment variables are set
    if (!mailchimpServerPrefix || !mailchimpListId) {
      console.error("Missing required environment variables:", { 
        mailchimpServerPrefix: !!mailchimpServerPrefix, 
        mailchimpListId: !!mailchimpListId 
      });
      return new Response(
        JSON.stringify({ error: 'Mailchimp API configuration is incomplete. Please check MAILCHIMP_SERVER_PREFIX and MAILCHIMP_LIST_ID environment variables.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Check if we're forcing a send for specific users
    const { users, forceSendToday } = await req.json().catch(() => ({ users: null, forceSendToday: false }));
    
    let usersToProcess = [];
    
    if (users && Array.isArray(users) && users.length > 0) {
      // If specific users are provided, use them
      console.log(`Processing specific users: ${users.length}`);
      usersToProcess = users;
    } else {
      // Otherwise fetch users who should receive emails now
      console.log("Fetching users who should receive emails now");
      
      // Get all users with preferences
      const { data: allUsers, error: fetchError } = await supabase
        .from('user_industry_preferences')
        .select('*');
        
      if (fetchError) {
        throw new Error(`Failed to fetch users: ${fetchError.message}`);
      }
      
      // Filter users based on their delivery time preference
      const now = new Date();
      
      usersToProcess = allUsers.filter(user => {
        if (!user.delivery_time || !user.timezone) {
          return false;
        }
        
        try {
          // Convert user's delivery time to their local time
          const [hours, minutes] = user.delivery_time.split(':').map(Number);
          
          // Get current time in user's timezone
          const userLocalTime = new Date(now.toLocaleString('en-US', { timeZone: user.timezone }));
          const userHour = userLocalTime.getHours();
          const userMinute = userLocalTime.getMinutes();
          
          // Check if current time is within 5 minutes of delivery time
          return Math.abs(userHour - hours) === 0 && Math.abs(userMinute - minutes) < 5;
        } catch (error) {
          console.error(`Error processing time for user ${user.email}:`, error);
          return false;
        }
      });
      
      console.log(`Found ${usersToProcess.length} users to process`);
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
          const today = format(now, 'yyyy-MM-dd');
          
          const { data: existingEmails, error: emailCheckError } = await supabase
            .from('sent_emails')
            .select('*')
            .eq('email', user.email)
            .gte('created_at', today);
            
          if (emailCheckError) {
            console.error(`Error checking sent emails for ${user.email}:`, emailCheckError);
          } else if (existingEmails && existingEmails.length > 0) {
            console.log(`Already sent email to ${user.email} today, skipping`);
            continue;
          }
        }
        
        // Generate content with temperature parameter
        const content = await generateContent(user.industry, user.tone_name, temperature);
        
        // Format the email content based on the template
        const emailContent = formatEmailContent(content, user.template, user.tone_name);
        
        // Send the email using the correct Mailchimp URL
        await sendEmail(user.email, `Your ${user.industry} Industry Update`, emailContent);
        
        // Record the sent email
        const { error: recordError } = await supabase
          .from('sent_emails')
          .insert({
            email: user.email,
            industry: user.industry,
            content_snippet: content.snippet,
            template: user.template
          });
          
        if (recordError) {
          console.error(`Error recording sent email for ${user.email}:`, recordError);
        }
        
        successes.push(user.email);
        console.log(`Successfully processed user ${user.email}`);
      } catch (error) {
        console.error(`Error processing user ${user.email}:`, error);
        errors.push({ email: user.email, error: error.message });
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
    console.error("Error in scheduled emails function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
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
        temperature: temperature, // Use the temperature parameter
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
    console.error("Error generating content:", error);
    throw error;
  }
}

function formatEmailContent(content: { title: string, content: string }, template = 'bullet-points-style-x-style', tone = 'professional') {
  // Extract format and style from template
  const [formatPart, stylePart] = template.split('-style-');
  const format = formatPart || 'bullet-points';
  const style = stylePart || 'x-style';
  
  // Basic HTML wrapper
  const htmlContent = `
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          h1, h2, h3 { color: #2c3e50; }
          .content { margin: 20px 0; }
          .footer { margin-top: 30px; font-size: 12px; color: #7f8c8d; border-top: 1px solid #eee; padding-top: 20px; }
        </style>
      </head>
      <body>
        <h2>${content.title}</h2>
        <div class="content">
          ${content.content}
        </div>
        <div class="footer">
          <p>This content was generated based on trends in the industry you selected.</p>
          <p>You're receiving this because you subscribed to industry updates.</p>
        </div>
      </body>
    </html>
  `;
  
  return htmlContent;
}

async function sendEmail(to: string, subject: string, htmlContent: string) {
  try {
    // Construct the proper Mailchimp API URL
    const mailchimpUrl = `https://${mailchimpServerPrefix}.api.mailchimp.com/3.0`;
    console.log(`Using Mailchimp API URL: ${mailchimpUrl} to send email to ${to}`);
    
    // Use Mailchimp Transactional API
    const response = await fetch(`${mailchimpUrl}/messages/send`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mailchimpApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          html: htmlContent,
          subject: subject,
          from_email: fromEmail,
          from_name: 'Industry Insights',
          to: [{ email: to, type: 'to' }],
        },
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Mailchimp API error: ${JSON.stringify(errorData)}`);
    }
    
    const data = await response.json();
    console.log(`Email sent to ${to}, Mailchimp response:`, data);
    return data;
  } catch (error) {
    console.error(`Error sending email to ${to}:`, error);
    throw error;
  }
}
