import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { Resend } from "npm:resend@2.0.0";

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') as string;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') as string;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { email, industry, template, deliveryTime, timezone, sendNow } = await req.json();
    
    console.log('Request received:', { email, industry, template, sendNow });

    if (!RESEND_API_KEY) {
      console.error('RESEND_API_KEY is not set');
      throw new Error('Resend API key is not configured');
    }
    
    if (!OPENAI_API_KEY) {
      console.error('OPENAI_API_KEY is not set');
      throw new Error('OpenAI API key is not configured');
    }

    // Always use the provided email (no override)
    const recipientEmail = email;
    console.log(`Will send email to: ${recipientEmail}`);

    // Generate content based on industry
    const content = await generateContent(industry, template);
    console.log('Content generated:', content.substring(0, 100) + '...');
    
    // If it's a sendNow request, send the email immediately
    if (sendNow) {
      console.log('Sending email immediately to:', recipientEmail);
      
      // Send a test email to both the original recipient and a test email
      const emailResponse = await sendEmail(recipientEmail, industry, template, content);
      console.log('Email sent response:', emailResponse);
      
      // Try also sending to zaydadasm07@gmail.com for testing
      if (recipientEmail !== "zaydadasm07@gmail.com") {
        try {
          console.log('Also sending test email to: zaydadasm07@gmail.com');
          await sendEmail("zaydadasm07@gmail.com", industry, template, content);
        } catch (error) {
          console.error('Error sending test email:', error);
          // Don't throw here, we'll continue with the main flow
        }
      }
      
      // Save to Supabase for record-keeping
      const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      try {
        const { error } = await supabase.from('content_history').insert({
          email: recipientEmail,
          industry: industry,
          template: template,
          content: content,
          sent_at: new Date().toISOString(),
        });
        
        if (error) {
          console.error('Error saving to content_history:', error);
        }
      } catch (dbError) {
        console.error('Database error:', dbError);
      }

      return new Response(JSON.stringify({ 
        success: true, 
        email: emailResponse,
        message: `Email sent successfully to ${recipientEmail} ${recipientEmail !== "zaydadasm07@gmail.com" ? "and to zaydadasm07@gmail.com" : ""}`,
        emailContent: content.substring(0, 300) + "..." // Return a preview of content for verification
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // If it's not a sendNow request, just return success (preferences were saved in the UI code)
    return new Response(JSON.stringify({ 
      success: true, 
      message: "Successfully saved preferences"
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('Error in mailchimp-subscribe function:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message || "Unknown error occurred" 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});

// Generate content using OpenAI based on industry and template
async function generateContent(industry: string, template: string) {
  console.log('Generating content for:', industry, template);
  
  // For immediate testing, just return sample content
  if (!industry || industry.trim() === '') {
    return `This is sample content for a generic industry. Please select a specific industry for better content.`;
  }
  
  // Parse template to get format and style
  let format = template;
  let style = "x-style";
  if (template.includes("-style-")) {
    [format, style] = template.split("-style-");
  }
  
  const formatPrompt = getFormatPrompt(format);
  const stylePrompt = getStylePrompt(style);
  
  try {
    // Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo', // Use a more reliable model
        messages: [
          {
            role: 'system',
            content: `You are a professional content creator specializing in ${industry} content. 
            Create a post about ${industry} following the guidelines below.`
          },
          {
            role: 'user',
            content: `Generate an engaging post for the ${industry} industry. 
            ${formatPrompt}
            ${stylePrompt}
            Make the post stand out with unique insights.`
          }
        ],
      }),
    });

    const data = await response.json();
    console.log('OpenAI API response status:', response.status);
    
    if (!data.choices || !data.choices[0]) {
      console.error('Unexpected OpenAI response:', data);
      return `Unable to generate ${industry} content. Here's a placeholder: 
      
      "5 Essential Tips for ${industry} Success:
      1. Focus on customer needs first
      2. Stay updated with industry trends
      3. Invest in quality tools and training
      4. Build a strong online presence
      5. Network with other professionals
      
      Success in ${industry} comes from consistent improvement and customer focus."`;
    }
    
    return data.choices[0].message.content;
  } catch (error) {
    console.error('Error calling OpenAI:', error);
    // Return a default sample content for testing if OpenAI fails
    return `Sample ${industry} content (OpenAI API unavailable):
    
    "5 Essential Tips for ${industry} Success:
    1. Focus on customer needs first
    2. Stay updated with industry trends
    3. Invest in quality tools and training
    4. Build a strong online presence
    5. Network with other professionals
    
    Success in ${industry} comes from consistent improvement and customer focus."`;
  }
}

// Get format-specific prompts
function getFormatPrompt(format: string) {
  switch (format) {
    case "bullet-points":
      return "Use a bullet point format with a strong headline, 4-5 bullet points, and a powerful conclusion.";
    case "numbered-list":
      return "Use a numbered list format with a compelling headline, 5 numbered points, and a summary conclusion.";
    case "tips-format":
      return "Format as a tip with a clear headline, a brief explanation, and 4-5 actionable checkpoints marked with ✓.";
    default:
      return "Use a bullet point format with a strong headline, 4-5 bullet points, and a powerful conclusion.";
  }
}

// Get style-specific prompts
function getStylePrompt(style: string) {
  switch (style) {
    case "x-style":
      return "Keep it concise, direct, and impactful - suitable for Twitter/X.com with about 280 characters.";
    case "linkedin-style":
      return "Use a professional tone with business insights. Include a personal angle and end with a question to encourage engagement. Add relevant hashtags.";
    case "thought-leadership":
      return "Take a bold, authoritative stance. Challenge conventional wisdom and position the content as expert insight.";
    case "newsletter-style":
      return "Use a conversational, personal tone as if writing directly to a friend. Include a greeting and sign-off.";
    default:
      return "Keep it concise, direct, and impactful.";
  }
}

// Send email directly to the user using Resend
async function sendEmail(email: string, industry: string, template: string, content: string) {
  console.log('Sending email to:', email);
  
  try {
    if (!email || email.trim() === '') {
      throw new Error("Email address is required");
    }
    
    if (!email.includes('@')) {
      throw new Error("Invalid email address format");
    }
    
    const resend = new Resend(RESEND_API_KEY);
    const htmlContent = formatContentAsHtml(content, industry, template);
    
    const response = await resend.emails.send({
      from: 'Content Generator <onboarding@resend.dev>',
      to: [email],
      subject: `Your ${industry} Content Update`,
      html: htmlContent,
    });
    
    console.log('Email sent successfully:', response);
    return response;
  } catch (error) {
    console.error('Email sending error:', error);
    throw new Error('Failed to send email: ' + (error.message || 'Unknown error'));
  }
}

// Format content as HTML email
function formatContentAsHtml(content: string, industry: string, template: string) {
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
        h2 { color: #444; margin-top: 30px; }
        ul, ol { margin-bottom: 20px; }
        li { margin-bottom: 8px; }
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
        <p>&copy; ${new Date().getFullYear()} Content Generator</p>
      </div>
    </body>
    </html>
  `;
}
