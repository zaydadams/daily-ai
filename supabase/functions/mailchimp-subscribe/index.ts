
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { OpenAI } from "https://deno.land/x/openai@1.3.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
const mailchimpApiKey = Deno.env.get('MAILCHIMP_API_KEY');
const mailchimpListId = Deno.env.get('MAILCHIMP_LIST_ID');
const mailchimpServerPrefix = Deno.env.get('MAILCHIMP_SERVER_PREFIX');

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseKey);

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
      temperature = 0.7,
      sendNow = false 
    } = await req.json();

    // Validate input
    if (!email) {
      return new Response(
        JSON.stringify({ error: 'Email is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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
        
        // Construct the proper Mailchimp API URL
        const mailchimpUrl = `https://${mailchimpServerPrefix}.api.mailchimp.com/3.0`;
        console.log(`Using Mailchimp API URL: ${mailchimpUrl}`);
        
        // Subscribe the user to Mailchimp list
        const mailchimpData = {
          email_address: email,
          status: 'subscribed',
        };

        const response = await fetch(`${mailchimpUrl}/lists/${mailchimpListId}/members`, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${btoa('anystring:' + mailchimpApiKey)}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(mailchimpData)
        });

        if (!response.ok) {
          const result = await response.json();
          console.error("Mailchimp error:", result);
          // If the user is already subscribed, update their status
          if (result.title === "Member Exists") {
            const hash = md5(email.toLowerCase());
            const updateResponse = await fetch(`${mailchimpUrl}/lists/${mailchimpListId}/members/${hash}`, {
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

    // Construct the proper Mailchimp API URL
    const mailchimpUrl = `https://${mailchimpServerPrefix}.api.mailchimp.com/3.0`;
    
    // Subscribe the user to Mailchimp list
    const mailchimpData = {
      email_address: email,
      status: 'subscribed',
    };

    const response = await fetch(`${mailchimpUrl}/lists/${mailchimpListId}/members`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa('anystring:' + mailchimpApiKey)}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(mailchimpData)
    });

    if (!response.ok) {
      const result = await response.json();
      console.error("Mailchimp error:", result);
      // If the user is already subscribed, update their status
      if (result.title === "Member Exists") {
        const hash = md5(email.toLowerCase());
        const updateResponse = await fetch(`${mailchimpUrl}/lists/${mailchimpListId}/members/${hash}`, {
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
