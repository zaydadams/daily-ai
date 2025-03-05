import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.33.1';
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { format } from "https://deno.land/std@0.168.0/datetime/mod.ts";
import { Resend } from "npm:resend@2.0.0";

// Initialize Supabase
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Get API keys from environment variables
const openaiApiKey = Deno.env.get('OPENAI_API_KEY')!;
const resendApiKey = Deno.env.get('RESEND_API_KEY')!;
const fromEmail = Deno.env.get('FROM_EMAIL') || 'noreply@example.com';

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
    
    if (users && Array.isArray(users) && users.length > 0 && forceSendToday) {
      // If specific users are provided AND forceSendToday is true, use them
      console.log(`Processing specific users with forceSendToday: ${users.length}`);
      usersToProcess = users;
    } else {
      // Otherwise fetch users who should receive emails now based on their delivery time
      console.log("Fetching users who should receive emails now based on delivery time");
      
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
        // Skip users who have auto-generate disabled
        if (!user.auto_generate) {
          return false;
        }
        
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
          const hourMatch = userHour === hours;
          const minuteMatch = Math.abs(userMinute - minutes) < 5;
          
          console.log(`User ${user.email}: Current time in timezone ${user.timezone}: ${userHour}:${userMinute}, delivery time: ${hours}:${minutes}, match: ${hourMatch && minuteMatch}`);
          
          return hourMatch && minuteMatch;
        } catch (error) {
          console.error(`Error processing time for user ${user.email}:`, error);
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
        
        // Generate 3 different content options for the email
        const contentOptions = [];
        for (let i = 0; i < 3; i++) {
          const content = await generateContent(user.industry, user.tone_name, temperature);
          contentOptions.push(content);
        }
        
        // Format the email content based on the template with 3 options
        const emailContent = formatEmailContent(contentOptions, user.template, user.tone_name, user.industry);
        
        // Send the email using Resend
        await sendEmail(user.email, `Your ${user.industry} Industry Update - 3 Content Options`, emailContent);
        
        // Record the sent email
        const { error: recordError } = await supabase
          .from('sent_emails')
          .insert({
            email: user.email,
            industry: user.industry,
            content_snippet: contentOptions[0].snippet,
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

function formatEmailContent(contentOptions: Array<{ title: string, content: string }>, template = 'bullet-points-style-x-style', tone = 'professional', industry = 'your industry') {
  // Extract format and style from template
  const [formatPart, stylePart] = template.split('-style-');
  const format = formatPart || 'bullet-points';
  const style = stylePart || 'x-style';
  
  const today = new Date();
  const formattedDate = today.toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  
  // Modernized HTML email template with 3 content options
  const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${industry} Industry Update</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #333;
          background-color: #f9f9f9;
          margin: 0;
          padding: 0;
        }
        .email-container {
          max-width: 600px;
          margin: 0 auto;
          background-color: #ffffff;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 0 10px rgba(0,0,0,0.05);
        }
        .header {
          background-color: #2c3e50;
          color: #ffffff;
          padding: 20px;
          text-align: center;
        }
        .date {
          color: #ecf0f1;
          font-size: 14px;
          margin-top: 5px;
        }
        .content {
          padding: 25px;
        }
        .option {
          margin-bottom: 30px;
          border-bottom: 1px solid #eee;
          padding-bottom: 25px;
        }
        .option:last-child {
          border-bottom: none;
          margin-bottom: 0;
        }
        h1 {
          color: #ffffff;
          font-size: 24px;
          margin: 0;
          font-weight: 600;
        }
        h2 {
          color: #2c3e50;
          font-size: 20px;
          margin-top: 0;
          margin-bottom: 15px;
          font-weight: 600;
        }
        .option-label {
          display: inline-block;
          background-color: #3498db;
          color: white;
          padding: 3px 10px;
          border-radius: 4px;
          font-size: 12px;
          margin-bottom: 10px;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        p {
          margin: 0 0 15px;
          font-size: 16px;
        }
        .footer {
          background-color: #f5f5f5;
          padding: 20px;
          text-align: center;
          font-size: 12px;
          color: #7f8c8d;
          border-top: 1px solid #eee;
        }
        .footer p {
          margin: 5px 0;
          font-size: 12px;
        }
        .cta-button {
          display: inline-block;
          background-color: #2980b9;
          color: white;
          text-decoration: none;
          padding: 10px 20px;
          border-radius: 4px;
          font-weight: 500;
          margin-top: 10px;
          margin-bottom: 5px;
        }
        .cta-button:hover {
          background-color: #3498db;
        }
        @media only screen and (max-width: 600px) {
          .email-container {
            width: 100%;
            border-radius: 0;
          }
          .content {
            padding: 15px;
          }
        }
      </style>
    </head>
    <body>
      <div class="email-container">
        <div class="header">
          <h1>${industry} Industry Update</h1>
          <div class="date">${formattedDate}</div>
        </div>
        
        <div class="content">
          <p>Here are three content options for your ${industry} business. Select the one that resonates most with your audience:</p>
          
          ${contentOptions.map((content, index) => `
            <div class="option">
              <div class="option-label">Option ${index + 1}</div>
              <h2>${content.title}</h2>
              <div>${content.content.replace(/\n/g, '<br>')}</div>
              
              <a href="#" class="cta-button">Use This Content</a>
            </div>
          `).join('')}
          
          <p>These insights are generated based on current industry trends and tailored to your preferences.</p>
        </div>
        
        <div class="footer">
          <p>You're receiving this because you subscribed to ${industry} industry updates.</p>
          <p>© ${new Date().getFullYear()} Writer Expert | <a href="#">Unsubscribe</a> | <a href="#">View in Browser</a></p>
        </div>
      </div>
    </body>
    </html>
  `;
  
  return htmlContent;
}

async function sendEmail(to: string, subject: string, htmlContent: string) {
  try {
    console.log(`Sending email to ${to} using Resend`);
    
    // Use Resend to send email
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
    
    console.log(`Email sent to ${to}, Resend response:`, emailResponse);
    return emailResponse;
  } catch (error) {
    console.error(`Error sending email to ${to}:`, error);
    throw error;
  }
}
