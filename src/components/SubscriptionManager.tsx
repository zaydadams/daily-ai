import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, CheckCircle, Zap } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/use-toast";

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
  const MONTHLY_PRICE_ID = 'price_1PxSsP2eZvKYloZDrQkWoXvK';
  const ANNUAL_PRICE_ID = 'price_1PxSsP2eZvKYloZDrQkWoXvK'; // Using same ID for demo, replace with actual annual price ID

  // Check subscription status when component mounts or email changes
  useEffect(() => {
    if (userEmail) {
      checkSubscriptionStatus();
    } else {
      setSubscriptionStatus('inactive');
    }
  }, [userEmail]);

  // Check for URL parameters after Stripe redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const subscriptionStatus = params.get('subscription');
    
    if (subscriptionStatus === 'success') {
      toast({
        title: "Subscription successful!",
        description: "Thank you for subscribing. You now have full access to all features.",
        variant: "default", // Changed from "success" to "default"
      });
      // Remove the query parameter to avoid showing the toast again on refresh
      const url = new URL(window.location.href);
      url.searchParams.delete('subscription');
      window.history.replaceState({}, '', url.toString());
      
      // Refresh subscription status
      checkSubscriptionStatus();
    } else if (subscriptionStatus === 'canceled') {
      toast({
        title: "Subscription canceled",
        description: "Your subscription process was canceled. You can try again anytime.",
        variant: "default",
      });
      // Remove the query parameter
      const url = new URL(window.location.href);
      url.searchParams.delete('subscription');
      window.history.replaceState({}, '', url.toString());
    }
  }, []);

  const checkSubscriptionStatus = async () => {
    if (!userEmail) return;
    
    setSubscriptionStatus('loading');
    setError(null);
    try {
      console.log('Checking subscription status for email:', userEmail);
      const { data, error } = await supabase.functions.invoke('stripe-subscription', {
        body: { 
          action: 'get-subscription-status',
          email: userEmail 
        }
      });
      
      if (error) {
        console.error('Error checking subscription:', error);
        setSubscriptionStatus('inactive');
        setError('Failed to check subscription status. Please try refreshing the page.');
        if (onSubscriptionStatusChange) onSubscriptionStatusChange('inactive');
        return;
      }
      
      console.log('Subscription status response:', data);
      setSubscriptionStatus(data.status);
      if (data.planType) setPlanType(data.planType);
      
      if (onSubscriptionStatusChange) onSubscriptionStatusChange(data.status);
    } catch (error) {
      console.error('Error checking subscription:', error);
      setSubscriptionStatus('inactive');
      setError('Failed to check subscription status. Please try refreshing the page.');
      if (onSubscriptionStatusChange) onSubscriptionStatusChange('inactive');
    }
  };

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
      console.log('Creating checkout session for email:', userEmail, 'with price ID:', priceId);
      const { data, error } = await supabase.functions.invoke('stripe-subscription', {
        body: { 
          action: 'create-checkout-session',
          email: userEmail,
          priceId: priceId
        }
      });
      
      if (error) {
        console.error('Error creating checkout session:', error);
        toast({
          title: "Error",
          description: "Failed to start subscription process. Please try again.",
          variant: "destructive",
        });
        setError('Failed to create checkout session. Please try again.');
        return;
      }
      
      console.log('Redirecting to Stripe checkout:', data.url);
      // Redirect to Stripe Checkout
      window.location.href = data.url;
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

  if (subscriptionStatus === 'loading') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Checking subscription status...</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Please wait while we check your subscription status.</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardHeader>
          <CardTitle className="flex items-center text-red-700">
            <AlertTriangle className="mr-2 h-5 w-5" />
            Error
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-700 mb-4">{error}</p>
          <Button onClick={checkSubscriptionStatus} variant="outline">
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (subscriptionStatus === 'active') {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardHeader>
          <CardTitle className="flex items-center text-green-700">
            <CheckCircle className="mr-2 h-5 w-5" />
            Active Subscription
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-green-700">
            Your {planType || "premium"} subscription is active. Enjoy unlimited access to all features!
          </p>
        </CardContent>
      </Card>
    );
  }

  if (subscriptionStatus === 'expired') {
    return (
      <Card className="border-amber-200 bg-amber-50">
        <CardHeader>
          <CardTitle className="flex items-center text-amber-700">
            <AlertTriangle className="mr-2 h-5 w-5" />
            Expired Subscription
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-amber-700 mb-4">
            Your subscription has expired. Renew now to continue using all features.
          </p>
          <div className="space-y-4">
            <Button 
              onClick={() => handleSubscribe(MONTHLY_PRICE_ID)} 
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? "Processing..." : "Renew Subscription"}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Default: inactive
  return (
    <Card>
      <CardHeader>
        <CardTitle>Choose a Subscription Plan</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="p-4 border rounded-lg bg-white">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold flex items-center">
                <Zap className="mr-2 h-5 w-5 text-amber-500" />
                Monthly Plan
              </h3>
              <span className="text-lg font-bold">$9.99/month</span>
            </div>
            <ul className="space-y-2 mb-4">
              <li className="flex items-start">
                <CheckCircle className="mr-2 h-4 w-4 text-green-500 mt-0.5" />
                <span>Unlimited daily content generation</span>
              </li>
              <li className="flex items-start">
                <CheckCircle className="mr-2 h-4 w-4 text-green-500 mt-0.5" />
                <span>Advanced AI temperature controls</span>
              </li>
              <li className="flex items-start">
                <CheckCircle className="mr-2 h-4 w-4 text-green-500 mt-0.5" />
                <span>All content templates and tones</span>
              </li>
            </ul>
            <Button 
              onClick={() => handleSubscribe(MONTHLY_PRICE_ID)} 
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? "Processing..." : "Subscribe Now"}
            </Button>
          </div>

          <div className="p-4 border rounded-lg bg-white">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold flex items-center">
                <Zap className="mr-2 h-5 w-5 text-emerald-500" />
                Annual Plan <span className="ml-2 text-xs px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full">Save 20%</span>
              </h3>
              <span className="text-lg font-bold">$95.88/year</span>
            </div>
            <ul className="space-y-2 mb-4">
              <li className="flex items-start">
                <CheckCircle className="mr-2 h-4 w-4 text-green-500 mt-0.5" />
                <span>All monthly plan features</span>
              </li>
              <li className="flex items-start">
                <CheckCircle className="mr-2 h-4 w-4 text-green-500 mt-0.5" />
                <span>Priority support</span>
              </li>
              <li className="flex items-start">
                <CheckCircle className="mr-2 h-4 w-4 text-green-500 mt-0.5" />
                <span>Early access to new features</span>
              </li>
            </ul>
            <Button 
              onClick={() => handleSubscribe(ANNUAL_PRICE_ID)} 
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? "Processing..." : "Subscribe Annually"}
            </Button>
          </div>

          <p className="text-xs text-center text-muted-foreground">
            Secure payment processing by Stripe. Cancel anytime.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
