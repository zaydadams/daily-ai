
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Zap } from "lucide-react";

interface SubscriptionPlansProps {
  onSubscribe: (priceId: string) => void;
  isLoading: boolean;
  monthlyPriceId: string;
  annualPriceId: string;
}

export function SubscriptionPlans({ 
  onSubscribe, 
  isLoading,
  monthlyPriceId,
  annualPriceId
}: SubscriptionPlansProps) {
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
              onClick={() => onSubscribe(monthlyPriceId)} 
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
              onClick={() => onSubscribe(annualPriceId)} 
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
