
import { supabase } from "@/lib/supabase";

export interface SubscriptionStatus {
  status: 'active' | 'inactive' | 'expired';
  planType?: string | null;
}

export async function checkSubscriptionStatus(userEmail: string | null): Promise<SubscriptionStatus> {
  if (!userEmail) {
    return { status: 'inactive' };
  }
  
  console.log('Checking subscription status for email:', userEmail);
  
  try {
    const { data, error } = await supabase.functions.invoke('stripe-subscription', {
      body: { 
        action: 'get-subscription-status',
        email: userEmail 
      }
    });
    
    if (error) {
      console.error('Error checking subscription:', error);
      throw new Error('Failed to check subscription status.');
    }
    
    console.log('Subscription status response:', data);
    return { 
      status: data.status,
      planType: data.planType
    };
  } catch (error) {
    console.error('Error checking subscription:', error);
    throw new Error('Failed to check subscription status.');
  }
}

export async function createCheckoutSession(userEmail: string, priceId: string): Promise<{ url: string }> {
  if (!userEmail) {
    throw new Error('User email is required');
  }
  
  console.log('Creating checkout session for email:', userEmail, 'with price ID:', priceId);
  
  try {
    const { data, error } = await supabase.functions.invoke('stripe-subscription', {
      body: { 
        action: 'create-checkout-session',
        email: userEmail,
        priceId: priceId
      }
    });
    
    if (error) {
      console.error('Error creating checkout session:', error);
      throw new Error('Failed to create checkout session.');
    }
    
    console.log('Redirecting to Stripe checkout:', data.url);
    return { url: data.url };
  } catch (error) {
    console.error('Error creating checkout session:', error);
    throw new Error('Failed to create checkout session.');
  }
}
