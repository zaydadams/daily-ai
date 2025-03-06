
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase client
    const authHeader = req.headers.get('Authorization');
    const apiKey = req.headers.get('apikey');
    
    if (!authHeader || !apiKey) {
      return new Response(JSON.stringify({ error: 'Missing required headers' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceRole) {
      console.error('Missing environment variables');
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceRole, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    
    // Get request body
    const { email } = await req.json();
    
    if (!email) {
      return new Response(JSON.stringify({ error: 'Email is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`Setting admin status for user: ${email}`);
    
    // Check if user already has a subscription
    const { data: existingSubscription, error: fetchError } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('email', email)
      .single();
      
    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Error checking existing subscription:', fetchError);
      return new Response(JSON.stringify({ error: 'Database error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // If user has a subscription, update it; otherwise, create a new one
    let result;
    if (existingSubscription) {
      result = await supabase
        .from('user_subscriptions')
        .update({
          status: 'active',
          plan_type: 'admin',
          updated_at: new Date().toISOString()
        })
        .eq('email', email);
    } else {
      result = await supabase
        .from('user_subscriptions')
        .insert({
          email: email,
          status: 'active',
          plan_type: 'admin',
          customer_id: 'admin-user',
          subscription_id: 'admin-subscription'
        });
    }
    
    if (result.error) {
      console.error('Error updating user subscription:', result.error);
      return new Response(JSON.stringify({ error: 'Failed to update subscription' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({ 
      success: true, 
      message: `User ${email} has been granted admin status with an active subscription`
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
