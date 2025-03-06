
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const resend = new Resend(RESEND_API_KEY);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, industry, template, deliveryTime, timezone, autoGenerate, toneName, temperature = 0.7, sendNow = false } = await req.json();

    if (!email) {
      return new Response(JSON.stringify({ error: 'Email is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Processing request for ${email}, industry: ${industry}, template: ${template}, sendNow: ${sendNow}, temperature: ${temperature}`);

    const { data, error: dbError } = await supabase
      .from('user_industry_preferences')
      .upsert([
        { email, industry, template, delivery_time: deliveryTime, timezone, auto_generate: autoGenerate, user_id: email, tone_name: toneName, temperature }
      ], { onConflict: 'user_id' });

    if (dbError) {
      console.error("Database error:", dbError);
      return new Response(JSON.stringify({ error: `Failed to save preferences: ${dbError.message}` }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (sendNow) {
      console.log("Sending email immediately");
      try {
        // Generate 3 content options
        const contentOptions = [];
        for (let i = 0; i < 3; i++) {
          const content = await generateContent(industry, toneName, temperature);
          contentOptions.push(content);
        }

        const htmlContent = formatContentAsHtml(contentOptions, industry, template);

        const response = await resend.emails.send({
          from: 'Writer Expert <shaun@writer.expert>',
          to: [email],
          subject: `Your ${industry} Content Update - 3 Content Options`,
          html: htmlContent,
          reply_to: "shaun@writer.expert"
        });

        console.log('Email sent successfully:', response);
        return new Response(JSON.stringify({ 
          success: true, 
          message: "Email sent successfully", 
          emailContent: contentOptions[0].snippet
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (error) {
        console.error("Error sending email:", error);
        return new Response(JSON.stringify({ error: `Failed to send email: ${error.message}` }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }
    
    // Return success if we just saved preferences without sending email
    return new Response(JSON.stringify({ success: true, message: "Preferences saved successfully" }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (error) {
    console.error("Error processing request:", error);
    return new Response(JSON.stringify({ error: `Server error: ${error.message}` }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Function to generate content using OpenAI
async function generateContent(industry, toneName = 'professional', temperature = 0.7) {
  try {
    console.log(`Generating content for industry: ${industry}, tone: ${toneName}, temperature: ${temperature}`);
    
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
      console.error("OpenAI error:", result);
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
    console.error("Error generating content:", error);
    throw error;
  }
}

// Function to format content options as a modern HTML email
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
}
