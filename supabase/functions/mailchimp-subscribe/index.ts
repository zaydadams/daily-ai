
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
        const content = await generateContent(industry, toneName, temperature);
        const htmlContent = formatContentAsHtml(content.snippet, industry, template);

        const response = await resend.emails.send({
          from: 'Writer Expert <shaun@writer.expert>',
          to: [email],
          subject: `Your ${industry} Content Update - From Writer Expert`,
          html: htmlContent,
          reply_to: "shaun@writer.expert"
        });

        console.log('Email sent successfully:', response);
        return new Response(JSON.stringify({ success: true, message: "Email sent successfully", emailContent: content.snippet }), {
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
    const snippet = json.choices[0].message.content;

    return { snippet };
  } catch (error) {
    console.error("Error generating content:", error);
    throw error;
  }
}

// Function to format content as an HTML email
function formatContentAsHtml(content, industry, template) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>Your ${industry} Content</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        h1 { color: #2b6fe5; }
        .content-block { background: #f9f9f9; border-left: 4px solid #2b6fe5; padding: 15px; margin: 25px 0; }
        .footer { margin-top: 40px; font-size: 12px; color: #888; border-top: 1px solid #eee; padding-top: 20px; }
      </style>
    </head>
    <body>
      <h1>Your ${industry} Content</h1>
      <p>Here is your custom content for your ${industry} business:</p>
      <div class="content-block">
        ${content.replace(/\n/g, '<br>')}
      </div>
      <div class="footer">
        <p>This content was generated based on your preferences.</p>
        <p>Template: ${template}</p>
        <p>Industry: ${industry}</p>
        <p>&copy; ${new Date().getFullYear()} Writer Expert</p>
      </div>
    </body>
    </html>
  `;
}
