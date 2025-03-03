import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import OpenAI from "https://deno.land/x/openai@1.3.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS', // Add this line
};

const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
const mailchimpApiKey = Deno.env.get('MAILCHIMP_API_KEY');
const mailchimpListId = Deno.env.get('MAILCHIMP_LIST_ID');
const mailchimpApiUrl = Deno.env.get('MAILCHIMP_API_URL');

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Update the request handler to accept and use temperature parameter
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      email, 
      industry, 
      template, 
      deliveryTime, 
      timezone, 
      autoGenerate,
      toneName,
      temperature = 0.7, // Default to 0.7 if not provided
      sendNow = false 
    } = await req.json();

    // Validate input
    if (!email) {
      return new Response(
        JSON.stringify({ error: 'Email is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing request for ${email}, industry: ${industry}, template: ${template}, sendNow: ${sendNow}, temperature: ${temperature}`);

    // Save preferences to Supabase
    const { data, error: dbError } = await supabase
      .from('user_industry_preferences')
      .upsert([
        {
          email: email,
          industry: industry,
          template: template,
          delivery_time: deliveryTime,
          timezone: timezone,
          auto_generate: autoGenerate,
          user_id: email,
          tone_name: toneName,
          temperature: temperature,
        }
      ], { onConflict: 'user_id' });

    if (dbError) {
      console.error("Database error:", dbError);
      return new Response(
        JSON.stringify({ error: `Failed to save preferences: ${dbError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // When sending email now, include the temperature parameter
    if (sendNow) {
      console.log("Sending email immediately");
      
      try {
        const content = await generateContent(industry, toneName, temperature);
        // Subscribe the user to Mailchimp list
        const data = {
          email_address: email,
          status: 'subscribed',
        };

        const response = await fetch(`${mailchimpApiUrl}/lists/${mailchimpListId}/members`, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${btoa('anystring:' + mailchimpApiKey)}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(data)
        });

        if (!response.ok) {
          const result = await response.json();
          console.error("Mailchimp error:", result);
          // If the user is already subscribed, update their status
          if (result.title === "Member Exists") {
            const hash = md5(email.toLowerCase());
            const updateResponse = await fetch(`${mailchimpApiUrl}/lists/${mailchimpListId}/members/${hash}`, {
              method: 'PATCH',
              headers: {
                'Authorization': `Basic ${btoa('anystring:' + mailchimpApiKey)}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ status: 'subscribed' })
            });

            if (!updateResponse.ok) {
              const updateResult = await updateResponse.json();
              console.error("Mailchimp update error:", updateResult);
              return new Response(
                JSON.stringify({ error: `Failed to subscribe to Mailchimp: ${updateResult.detail}` }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }
          } else {
            return new Response(
              JSON.stringify({ error: `Failed to subscribe to Mailchimp: ${result.detail}` }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }

        console.log("Email sent successfully");
        return new Response(
          JSON.stringify({ success: true, message: "Email sent successfully", emailContent: content.snippet }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (error) {
        console.error("Error sending email:", error);
        return new Response(
          JSON.stringify({ error: `Failed to send email: ${error.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Subscribe the user to Mailchimp list
    const data = {
      email_address: email,
      status: 'subscribed',
    };

    const response = await fetch(`${mailchimpApiUrl}/lists/${mailchimpListId}/members`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa('anystring:' + mailchimpApiKey)}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const result = await response.json();
      console.error("Mailchimp error:", result);
      // If the user is already subscribed, update their status
      if (result.title === "Member Exists") {
        const hash = md5(email.toLowerCase());
        const updateResponse = await fetch(`${mailchimpApiUrl}/lists/${mailchimpListId}/members/${hash}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Basic ${btoa('anystring:' + mailchimpApiKey)}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ status: 'subscribed' })
        });

        if (!updateResponse.ok) {
          const updateResult = await updateResponse.json();
          console.error("Mailchimp update error:", updateResult);
          return new Response(
            JSON.stringify({ error: `Failed to subscribe to Mailchimp: ${updateResult.detail}` }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } else {
        return new Response(
          JSON.stringify({ error: `Failed to subscribe to Mailchimp: ${result.detail}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Update the generateContent function to use temperature
async function generateContent(industry: string, toneName = 'professional', temperature = 0.7) {
  try {
    console.log(`Generating content for industry: ${industry}, tone: ${toneName}, temperature: ${temperature}`);
    
    const openai = new OpenAI(openaiApiKey);

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

// Simple MD5 hash function for email (for Mailchimp)
function md5(str: string) {
  let hash = 0;
  if (str.length === 0) {
    return hash.toString();
  }
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(16);
}
