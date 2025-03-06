
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle } from "lucide-react";

interface SubscriptionStatusProps {
  status: 'loading' | 'active' | 'inactive' | 'expired';
  planType: string | null;
  onRetry: () => void;
  onRenew?: () => void;
  error: string | null;
}

export function SubscriptionStatus({ 
  status, 
  planType, 
  onRetry, 
  onRenew,
  error 
}: SubscriptionStatusProps) {
  if (status === 'loading') {
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
          <Button onClick={onRetry} variant="outline">
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (status === 'active') {
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

  if (status === 'expired') {
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
          {onRenew && (
            <Button 
              onClick={onRenew} 
              className="w-full"
            >
              Renew Subscription
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  // Default: inactive
  return null;
}
