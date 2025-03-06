
import { useEffect } from 'react';
import { useToast } from "@/components/ui/use-toast";

export function useSubscriptionRedirectHandler(onSuccess: () => void) {
  const { toast } = useToast();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const subscriptionStatus = params.get('subscription');
    
    if (subscriptionStatus === 'success') {
      toast({
        title: "Subscription successful!",
        description: "Thank you for subscribing. You now have full access to all features.",
        variant: "default",
      });
      // Remove the query parameter to avoid showing the toast again on refresh
      const url = new URL(window.location.href);
      url.searchParams.delete('subscription');
      window.history.replaceState({}, '', url.toString());
      
      // Refresh subscription status
      onSuccess();
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
  }, [onSuccess, toast]);
}
