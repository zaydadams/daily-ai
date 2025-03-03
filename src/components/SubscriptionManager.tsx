
import { useState, useEffect } from "react";
import { useToast } from "@/components/ui/use-toast";
import { SubscriptionStatus } from "./subscription/SubscriptionStatus";
import { SubscriptionPlans } from "./subscription/SubscriptionPlans";
import { checkSubscriptionStatus, createCheckoutSession } from "@/services/SubscriptionService";
import { useSubscriptionRedirectHandler } from "@/utils/urlUtils";

interface SubscriptionManagerProps {
  userEmail: string | null;
  onSubscriptionStatusChange?: (status: 'active' | 'inactive' | 'expired') => void;
}

export function SubscriptionManager({ userEmail, onSubscriptionStatusChange }: SubscriptionManagerProps) {
  const [subscriptionStatus, setSubscriptionStatus] = useState<'loading' | 'active' | 'inactive' | 'expired'>('loading');
  const [planType, setPlanType] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Price IDs for subscriptions (replace with your actual Stripe price IDs)
  const MONTHLY_PRICE_ID = 'price_1QyWIYCu382Q0KlDz3M8weIX';
  const ANNUAL_PRICE_ID = 'price_1QyWJwCu382Q0KlDFB6VtzLv'; // Using same ID for demo, replace with actual annual price ID

  // Check subscription status when component mounts or email changes
  useEffect(() => {
    if (userEmail) {
      handleCheckSubscriptionStatus();
    } else {
      setSubscriptionStatus('inactive');
    }
  }, [userEmail]);

  // Handle URL parameters after Stripe redirect
  useSubscriptionRedirectHandler(handleCheckSubscriptionStatus);

  async function handleCheckSubscriptionStatus() {
    if (!userEmail) {
      setSubscriptionStatus('inactive');
      if (onSubscriptionStatusChange) onSubscriptionStatusChange('inactive');
      return;
    }
    
    setSubscriptionStatus('loading');
    setError(null);
    
    try {
      const result = await checkSubscriptionStatus(userEmail);
      setSubscriptionStatus(result.status);
      if (result.planType) setPlanType(result.planType);
      
      if (onSubscriptionStatusChange) onSubscriptionStatusChange(result.status);
    } catch (error) {
      console.error('Error checking subscription:', error);
      setSubscriptionStatus('inactive');
      setError('Failed to check subscription status. Please try refreshing the page.');
      if (onSubscriptionStatusChange) onSubscriptionStatusChange('inactive');
    }
  }

  const handleSubscribe = async (priceId: string) => {
    if (!userEmail) {
      toast({
        title: "Error",
        description: "Please sign in to subscribe.",
        variant: "destructive",
      });
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const { url } = await createCheckoutSession(userEmail, priceId);
      window.location.href = url;
    } catch (error) {
      console.error('Error creating checkout session:', error);
      toast({
        title: "Error",
        description: "Failed to start subscription process. Please try again.",
        variant: "destructive",
      });
      setError('Failed to create checkout session. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // If status is inactive, show subscription plans
  if (subscriptionStatus === 'inactive') {
    return (
      <SubscriptionPlans 
        onSubscribe={handleSubscribe} 
        isLoading={isLoading}
        monthlyPriceId={MONTHLY_PRICE_ID}
        annualPriceId={ANNUAL_PRICE_ID}
      />
    );
  }

  // Show subscription status for all other states (loading, active, expired, error)
  return (
    <SubscriptionStatus 
      status={subscriptionStatus} 
      planType={planType} 
      onRetry={handleCheckSubscriptionStatus}
      onRenew={subscriptionStatus === 'expired' ? () => handleSubscribe(MONTHLY_PRICE_ID) : undefined}
      error={error}
    />
  );
}
