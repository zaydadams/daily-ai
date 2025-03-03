
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.33.1';
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from 'https://esm.sh/stripe@13.11.0';

// Initialize Stripe
const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2023-10-16',
});

// Initialize Supabase
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseKey);

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
    const { action, email, priceId } = await req.json();
    
    console.log(`Processing ${action} request for email: ${email}`);
    
    if (!email) {
      return new Response(
        JSON.stringify({ error: 'Email is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle different actions
    switch (action) {
      case 'create-checkout-session': {
        if (!priceId) {
          return new Response(
            JSON.stringify({ error: 'Price ID is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log('Creating checkout session for:', email, 'with price ID:', priceId);

        // Create a checkout session
        const session = await stripe.checkout.sessions.create({
          payment_method_types: ['card'],
          line_items: [
            {
              price: priceId,
              quantity: 1,
            },
          ],
          mode: 'subscription',
          success_url: `${req.headers.get('origin')}/dashboard?subscription=success`,
          cancel_url: `${req.headers.get('origin')}/dashboard?subscription=canceled`,
          customer_email: email,
          client_reference_id: email,
          metadata: {
            email,
          },
        });

        console.log('Checkout session created:', session.id);

        return new Response(
          JSON.stringify({ url: session.url }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'get-subscription-status': {
        console.log('Checking subscription status for:', email);
        
        try {
          // Check if user exists in user_subscriptions
          const { data: subscription, error: subscriptionError } = await supabase
            .from('user_subscriptions')
            .select('*')
            .eq('email', email)
            .maybeSingle();

          if (subscriptionError) {
            console.error('Database error fetching subscription:', subscriptionError);
            return new Response(
              JSON.stringify({ error: 'Error fetching subscription data: ' + subscriptionError.message }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          console.log('Subscription data retrieved:', subscription);

          if (!subscription) {
            console.log('No active subscription found for:', email);
            return new Response(
              JSON.stringify({ status: 'inactive', message: 'No active subscription found' }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          // If subscription exists but expired
          if (subscription.expires_at && new Date(subscription.expires_at) < new Date()) {
            console.log('Subscription expired for:', email);
            return new Response(
              JSON.stringify({ status: 'expired', message: 'Subscription has expired' }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          // Active subscription
          console.log('Active subscription found for:', email);
          return new Response(
            JSON.stringify({ 
              status: 'active', 
              planType: subscription.plan_type,
              customerId: subscription.customer_id,
              subscriptionId: subscription.subscription_id
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } catch (error) {
          console.error('Unexpected error in get-subscription-status:', error);
          return new Response(
            JSON.stringify({ error: 'Unexpected error: ' + error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // Add a subscription record manually (for testing or admin purposes)
      case 'add-subscription': {
        console.log('Adding test subscription for:', email);
        
        const { planType = 'monthly', expiresAt } = await req.json();
        
        const { data, error } = await supabase
          .from('user_subscriptions')
          .upsert({
            email,
            plan_type: planType,
            status: 'active',
            expires_at: expiresAt || null,
            updated_at: new Date().toISOString()
          })
          .select()
          .single();
          
        if (error) {
          console.error('Error adding test subscription:', error);
          return new Response(
            JSON.stringify({ error: 'Failed to add subscription: ' + error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        return new Response(
          JSON.stringify({ success: true, subscription: data }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error) {
    console.error('Error processing request:', error);
    return new Response(
      JSON.stringify({ error: 'Unexpected server error: ' + error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
