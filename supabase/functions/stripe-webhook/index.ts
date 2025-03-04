
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

// This is your Stripe webhook endpoint secret for testing your endpoint
// locally with the Stripe CLI (https://stripe.com/docs/webhooks/test)
const endpointSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') || '';

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
    // Get the signature from the headers
    const signature = req.headers.get('stripe-signature');
    
    if (!signature) {
      console.error('Missing stripe-signature header');
      return new Response(
        JSON.stringify({ error: 'Missing stripe-signature header' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Get the raw request body
    const body = await req.text();
    
    let event;
    
    // Verify webhook signature and extract the event
    try {
      event = stripe.webhooks.constructEvent(body, signature, endpointSecret);
    } catch (err) {
      console.error(`Webhook signature verification failed: ${err.message}`);
      return new Response(
        JSON.stringify({ error: `Webhook Error: ${err.message}` }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Store the event in the database
    const { error: storeError } = await supabase
      .from('webhook_events')
      .insert({
        event_id: event.id,
        event_type: event.type,
        event_data: event
      });
      
    if (storeError) {
      console.error('Error storing webhook event:', storeError);
    }
    
    // Handle specific event types
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        
        // Extract customer email and metadata
        const customerEmail = session.customer_email || session.metadata?.email;
        
        if (!customerEmail) {
          console.error('No customer email found in session');
          return new Response(
            JSON.stringify({ error: 'No customer email found in session' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }
        
        // Get subscription details if available
        const subscriptionId = session.subscription;
        let subscription;
        let planType = 'monthly';
        let expiresAt = null;
        
        if (subscriptionId) {
          subscription = await stripe.subscriptions.retrieve(subscriptionId);
          
          // Determine plan type from subscription
          const interval = subscription.items.data[0]?.plan?.interval;
          planType = interval || 'monthly';
          
          // Calculate expiry date if subscription has one
          if (subscription.current_period_end) {
            expiresAt = new Date(subscription.current_period_end * 1000).toISOString();
          }
        }
        
        // Update or create user subscription
        const { error: upsertError } = await supabase
          .from('user_subscriptions')
          .upsert({
            email: customerEmail,
            customer_id: session.customer,
            subscription_id: subscriptionId,
            plan_type: planType,
            status: 'active',
            updated_at: new Date().toISOString(),
            expires_at: expiresAt
          }, { onConflict: 'email' });
          
        if (upsertError) {
          console.error('Error upserting subscription:', upsertError);
          return new Response(
            JSON.stringify({ error: 'Error updating subscription data' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
          );
        }
        
        console.log(`Subscription created for ${customerEmail}`);
        break;
      }
      
      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const customerId = subscription.customer;
        
        // Get customer email
        const customer = await stripe.customers.retrieve(customerId as string);
        const customerEmail = customer.email;
        
        if (!customerEmail) {
          console.error('No customer email found');
          return new Response(
            JSON.stringify({ error: 'No customer email found' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }
        
        // Determine plan type from subscription
        const interval = subscription.items.data[0]?.plan?.interval;
        const planType = interval || 'monthly';
        
        // Calculate expiry date if subscription has one
        let expiresAt = null;
        if (subscription.current_period_end) {
          expiresAt = new Date(subscription.current_period_end * 1000).toISOString();
        }
        
        // Update subscription in database
        const { error: updateError } = await supabase
          .from('user_subscriptions')
          .update({
            subscription_id: subscription.id,
            plan_type: planType,
            status: subscription.status,
            updated_at: new Date().toISOString(),
            expires_at: expiresAt
          })
          .eq('email', customerEmail);
          
        if (updateError) {
          console.error('Error updating subscription:', updateError);
          return new Response(
            JSON.stringify({ error: 'Error updating subscription data' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
          );
        }
        
        console.log(`Subscription updated for ${customerEmail}`);
        break;
      }
      
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const customerId = subscription.customer;
        
        // Get customer email
        const customer = await stripe.customers.retrieve(customerId as string);
        const customerEmail = customer.email;
        
        if (!customerEmail) {
          console.error('No customer email found');
          return new Response(
            JSON.stringify({ error: 'No customer email found' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }
        
        // Update subscription status to canceled
        const { error: updateError } = await supabase
          .from('user_subscriptions')
          .update({
            status: 'canceled',
            updated_at: new Date().toISOString()
          })
          .eq('email', customerEmail);
          
        if (updateError) {
          console.error('Error updating subscription:', updateError);
          return new Response(
            JSON.stringify({ error: 'Error updating subscription data' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
          );
        }
        
        console.log(`Subscription canceled for ${customerEmail}`);
        break;
      }
      
      default:
        // Unexpected event type
        console.log(`Unhandled event type: ${event.type}`);
    }
    
    return new Response(
      JSON.stringify({ received: true }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error processing webhook:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
