import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.33.1';
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { format } from "https://deno.land/std@0.168.0/datetime/mod.ts";

// Initialize Supabase
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Get API keys from environment variables
const openaiApiKey = Deno.env.get('OPENAI_API_KEY')!;
const resendApiKey = Deno.env.get('RESEND_API_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { users, forceSendToday } = await req.json().catch(() => ({ users: null, forceSendToday: false }));
    let usersToProcess = [];

    if (users && Array.isArray(users) && users.length > 0) {
      usersToProcess = users;
    } else {
      const { data: allUsers, error: fetchError } = await supabase
        .from('user_industry_preferences')
        .select('*');

      if (fetchError) {
        throw new Error(`Failed to fetch users: ${fetchError.message}`);
      }

      const now = new Date();
      usersToProcess = allUsers.filter(user => {
        if (!user.delivery_time || !user.timezone) {
          return false;
        }

        try {
          const [hours, minutes] = user.delivery_time.split(':').map(Number);
          const userLocalTime = new Date(now.toLocaleString('en-US', { timeZone: user.timezone }));
          return userLocalTime.getHours() === hours && Math.abs(userLocalTime.getMinutes() - minutes) < 5;
        } catch (error) {
          console.error(`Error processing time for user ${user.email}:`, error);
          return false;
        }
      });
    }

    const errors = [];
    const successes = [];

    for (const user of usersToProcess) {
      try {
        if (!user.auto_generate && !forceSendToday) continue;

        const temperature = user.temperature || 0.7;
        const today = format(new Date(), 'yyyy-MM-dd');

        if (!forceSendToday) {
          const { data: existingEmails } = await supabase
            .from('sent_emails')
            .select('*')
            .eq('email', user.email)
            .gte('created_at', today);

          if (existingEmails?.length > 0) continue;
        }

        const content = await generateContent(user.industry, user.tone_name, temperature);
        const emailContent = formatEmailContent(content, user.template, user.tone_name);

        await sendEmail(user.email, `Your ${user.industry} Industry Update`, emailContent);

        await supabase
          .from('sent_emails')
          .insert({ email: user.email, industry: user.industry, content_snippet: content.snippet, template: user.template });

        successes.push(user.email);
      } catch (error) {
        errors.push({ email: user.email, error: error.message });
      }
    }

    return new Response(
      JSON.stringify({ success: true, processed: usersToProcess.length, successes, errors }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function sendEmail(to: string, subject: string, html: string) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [to],
      subject,
      html,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to send email: ${errorText}`);
  }

  return response.json();
}
