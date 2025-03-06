import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Environment variables
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');

// Initialize clients
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const resend = new Resend(RESEND_API_KEY);

// Detailed logging function with DB storage
async function detailedLog(message: string, data?: any) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  const logData = data ? JSON.stringify(data, null, 2) : null;
  
  console.log(logMessage, logData || '');
  
  try {
    // Store log in database for later analysis
    await supabase.from('debug_logs').insert({
      message: logMessage,
      data: data ? data : null,
      created_at: new Date()
    });
  } catch (logError) {
    console.error("Error storing log:", logError);
  }
}

// Main serve function
serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    await detailedLog('Edge function invoked', { 
      headers: Object.fromEntries([...req.headers.entries()]),
      method: req.method,
      url: req.url
    });

    // Log environment variable status (without showing values)
    await detailedLog('Environment variables status', {
      OPENAI_API_KEY: !!OPENAI_API_KEY ? 'set' : 'missing',
      RESEND_API_KEY: !!RESEND_API_KEY ? 'set' : 'missing',
      SUPABASE_URL: !!SUPABASE_URL ? 'set' : 'missing',
      SUPABASE_ANON_KEY: !!SUPABASE_ANON_KEY ? 'set' : 'missing'
    });

    let requestBody;
    try {
      requestBody = await req.json();
      await detailedLog('Request body received', requestBody);
    } catch (parseError) {
      await detailedLog('Failed to parse request body', { error: parseError.message });
      const rawBody = await req.text();
      await detailedLog('Raw request body', { body: rawBody });
      throw new Error(`Failed to parse request body: ${parseError.message}`);
    }

    // Process users from request
    const usersToProcess = requestBody.users || [];
    await detailedLog(`Found ${usersToProcess.length} users to process`, {
      userCount: usersToProcess.length
    });

    if (usersToProcess.length === 0) {
      await detailedLog('No users to process, ending function');
      return new Response(
        JSON.stringify({ success: true, message: 'No users to process' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Test email sending directly
    try {
      const testEmailResponse = await resend.emails.send({
        from: 'Writer Expert <shaun@writer.expert>',
        to: ['zaydadams07@gmail.com'], // Update with your email for testing
        subject: 'TEST - Email Service Verification',
        html: '<p>This is a test email to verify the email service is working.</p>'
      });
      
      await detailedLog('Test email sent', testEmailResponse);
    } catch (testEmailError) {
      await detailedLog('Test email failed', { error: testEmailError.message });
    }

    // Process users (simplified for debugging)
    for (const user of usersToProcess) {
      try {
        await detailedLog(`Processing user`, {
          email: user.email,
          industry: user.industry,
          timezone: user.timezone
        });

        // Test content generation
        let content;
        try {
          content = await generateTestContent(user.industry);
          await detailedLog('Content generated successfully', { 
            contentLength: content.length,
            excerpt: content.substring(0, 100) + '...' 
          });
        } catch (contentError) {
          await detailedLog('Content generation failed', { 
            error: contentError.message 
          });
          throw contentError;
        }

        // Format basic email
        const htmlContent = `
          <!DOCTYPE html>
          <html>
          <body>
            <h1>Test Email for ${user.industry}</h1>
            <p>${content}</p>
          </body>
          </html>
        `;

        // Send email
        try {
          const emailResponse = await resend.emails.send({
            from: 'Writer Expert <shaun@writer.expert>',
            to: [user.email],
            subject: `TEST - ${user.industry} Content Update`,
            html: htmlContent,
            reply_to: "shaun@writer.expert"
          });

          await detailedLog(`Email sent successfully`, {
            email: user.email,
            response: emailResponse
          });
        } catch (emailError) {
          await detailedLog(`Email sending failed`, {
            email: user.email,
            error: emailError.message,
            stack: emailError.stack
          });
          throw emailError;
        }
      } catch (userError) {
        await detailedLog(`Error processing user`, {
          email: user.email,
          error: userError.message
        });
      }
    }

    await detailedLog('Function completed successfully');
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        processed: usersToProcess.length,
        message: 'Debug run completed'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (globalError) {
    await detailedLog('Global error in function', {
      error: globalError.message,
      stack: globalError.stack
    });

    return new Response(
      JSON.stringify({ 
        error: globalError.message,
        stack: globalError.stack 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

// Simple test content generation to avoid OpenAI API issues
async function generateTestContent(industry) {
  try {
    // First try OpenAI
    const content = await generateWithOpenAI(industry);
    return content;
  } catch (openaiError) {
    await detailedLog('OpenAI generation failed, using fallback content', { error: openaiError.message });
    
    // Fallback to static content
    return `Here's some interesting content about the ${industry} industry. This is a fallback message because there was an issue with the content generation service.`;
  }
}

async function generateWithOpenAI(industry) {
  if (!OPENAI_API_KEY) {
    throw new Error('OpenAI API key is not configured');
  }
  
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
          content: `Generate a short paragraph about the ${industry} industry.`
        }
      ],
      temperature: 0.7,
      max_tokens: 150,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`);
  }

  const json = await response.json();
  return json.choices[0].message.content.trim();
}
