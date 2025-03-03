
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
  const { toast } = useToast();

  // Check subscription status when component mounts or email changes
  useEffect(() => {
    if (userEmail) {
      checkSubscriptionStatus();
    } else {
      setSubscriptionStatus('inactive');
    }
  }, [userEmail]);

  const checkSubscriptionStatus = async () => {
    if (!userEmail) return;
    
    setSubscriptionStatus('loading');
    try {
      const { data, error } = await supabase.functions.invoke('stripe-subscription', {
        body: { 
          action: 'get-subscription-status',
          email: userEmail 
        }
      });
      
      if (error) {
        console.error('Error checking subscription:', error);
        setSubscriptionStatus('inactive');
        if (onSubscriptionStatusChange) onSubscriptionStatusChange('inactive');
        return;
      }
      
      setSubscriptionStatus(data.status);
      if (data.planType) setPlanType(data.planType);
      
      if (onSubscriptionStatusChange) onSubscriptionStatusChange(data.status);
    } catch (error) {
      console.error('Error checking subscription:', error);
      setSubscriptionStatus('inactive');
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
    try {
      const { data, error } = await supabase.functions.invoke('stripe-subscription', {
        body: { 
          action: 'create-checkout-session',
          email: userEmail,
          priceId: priceId
        }
      });
      
      if (error) {
        toast({
          title: "Error",
          description: "Failed to start subscription process. Please try again.",
          variant: "destructive",
        });
        return;
      }
      
      // Redirect to Stripe Checkout
      window.location.href = data.url;
    } catch (error) {
      console.error('Error creating checkout session:', error);
      toast({
        title: "Error",
        description: "Failed to start subscription process. Please try again.",
        variant: "destructive",
      });
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
              onClick={() => handleSubscribe('price_1PxSsP2eZvKYloZDrQkWoXvK')} 
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
              onClick={() => handleSubscribe('price_1PxSsP2eZvKYloZDrQkWoXvK')} 
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
              onClick={() => handleSubscribe('price_1PxSsP2eZvKYloZDrQkWoXvK')} 
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
