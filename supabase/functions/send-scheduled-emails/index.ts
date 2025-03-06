
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// CORS headers for browser requests
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Interface for user preferences
interface UserToEmail {
  email: string;
  industry: string;
  template: string;
  timezone: string;
  auto_generate: boolean;
}

// Interface for the request body
interface RequestBody {
  users: UserToEmail[];
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse the request body
    const requestData: RequestBody = await req.json();
    const { users } = requestData;

    console.log(`Processing scheduled emails for ${users?.length || 0} users`);

    // If no users to email, return early
    if (!users || users.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No emails to send at this time" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Process each user
    const results = await Promise.all(
      users.map(async (user) => {
        try {
          console.log(`Generating content for ${user.email} in ${user.industry} industry with template ${user.template}`);
          
          // Log that we're about to generate this email
          const { data: logData, error: logError } = await supabase
            .from("scheduled_email_logs")
            .insert({
              email: user.email,
              industry: user.industry,
              template: user.template,
              status: "generating"
            })
            .select("id")
            .single();
            
          if (logError) {
            console.error(`Error logging scheduled email for ${user.email}:`, logError);
          }
          
          // Call the content generation function
          const { data: generatedData, error: generateError } = await supabase.functions.invoke(
            "generate-industry-content",
            {
              body: { 
                industry: user.industry,
                template: user.template,
              },
            }
          );

          if (generateError) {
            console.error(`Error generating content for ${user.email}:`, generateError);
            
            // Update log with error
            if (logData?.id) {
              await supabase
                .from("scheduled_email_logs")
                .update({ 
                  status: "error", 
                  error_message: `Content generation failed: ${generateError.message || "Unknown error"}`
                })
                .eq("id", logData.id);
            }
            
            return {
              email: user.email,
              success: false,
              error: `Content generation failed: ${generateError.message || "Unknown error"}`
            };
          }

          // Extract the generated content
          const emailContent = generatedData.content;
          
          // Log the content for debugging
          console.log(`Generated content for ${user.email}, now sending email`);
          
          // Send the email using mailchimp-subscribe function (which already supports sending emails)
          const { data: mailData, error: mailError } = await supabase.functions.invoke(
            "mailchimp-subscribe",
            {
              body: { 
                email: user.email,
                industry: user.industry,
                template: user.template,
                sendNow: true,
                emailContent: emailContent // Pass the pre-generated content
              },
            }
          );

          if (mailError) {
            console.error(`Error sending email to ${user.email}:`, mailError);
            
            // Update log with error
            if (logData?.id) {
              await supabase
                .from("scheduled_email_logs")
                .update({ 
                  status: "error", 
                  error_message: `Email sending failed: ${mailError.message || "Unknown error"}`
                })
                .eq("id", logData.id);
            }
            
            return {
              email: user.email,
              success: false,
              error: `Email sending failed: ${mailError.message || "Unknown error"}`
            };
          }

          // Update the log with success
          if (logData?.id) {
            await supabase
              .from("scheduled_email_logs")
              .update({ 
                status: "sent",
                content: emailContent
              })
              .eq("id", logData.id);
          }
          
          // Also store in content history
          await supabase
            .from("content_history")
            .insert({
              email: user.email,
              industry: user.industry,
              template: user.template,
              content: emailContent
            });

          console.log(`Successfully sent email to ${user.email}`);
          return {
            email: user.email,
            success: true
          };
          
        } catch (error) {
          console.error(`Unexpected error processing email for ${user.email}:`, error);
          return {
            email: user.email,
            success: false,
            error: error.message || "Unexpected error"
          };
        }
      })
    );

    // Return the results
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Processed ${users.length} scheduled emails`,
        results 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
    
  } catch (error) {
    console.error("Error in send-scheduled-emails function:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || "An unexpected error occurred" 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
