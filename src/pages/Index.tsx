
import { useState, useEffect } from "react";
import { IndustrySelect } from "@/components/IndustrySelect";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { TemplateSelector } from "@/components/TemplateSelector";
import { TimePreference } from "@/components/TimePreference";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

const Index = () => {
  const [selectedIndustry, setSelectedIndustry] = useState("");
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState("bullet-points");
  const [deliveryTime, setDeliveryTime] = useState("09:00");
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [activeTab, setActiveTab] = useState("preferences");
  const [autoGenerateEnabled, setAutoGenerateEnabled] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    // Get the current user's email
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.email) {
        setUserEmail(session.user.email);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUserEmail(session?.user?.email ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleIndustrySelect = (industry: string) => {
    setSelectedIndustry(industry);
  };

  const handleSubscribe = async () => {
    if (!userEmail || !selectedIndustry) {
      toast({
        title: "Error",
        description: !userEmail 
          ? "Please sign in to subscribe to updates." 
          : "Please select an industry first.",
        variant: "destructive",
      });
      return;
    }

    setIsSubscribing(true);
    try {
      // Save to Supabase
      await supabase
        .from('user_industry_preferences')
        .upsert([
          {
            email: userEmail,
            industry: selectedIndustry,
            template: selectedTemplate,
            delivery_time: deliveryTime,
            timezone: timezone,
            auto_generate: autoGenerateEnabled,
            user_id: userEmail,
          }
        ]);

      // Subscribe to Mailchimp
      const { error } = await supabase.functions.invoke('mailchimp-subscribe', {
        body: { 
          email: userEmail, 
          industry: selectedIndustry,
          template: selectedTemplate,
          deliveryTime: deliveryTime,
          timezone: timezone,
        },
      });

      if (error) throw error;

      toast({
        title: "Success!",
        description: "Your preferences have been saved. You'll receive daily content based on your settings.",
      });
    } catch (error) {
      console.error('Error subscribing:', error);
      toast({
        title: "Error",
        description: "Failed to save preferences. Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsSubscribing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#020817] to-[#0F172A] py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12 animate-fade-in">
          <h1 className="text-5xl font-bold text-[#3b7ff5] mb-4 drop-shadow-lg">
            Content Generator Dashboard
          </h1>
          <p className="text-[#8E9196] max-w-2xl mx-auto text-lg">
            Set your preferences to receive customized content for your industry
          </p>
        </div>

        <Tabs defaultValue="preferences" className="mb-8" onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="preferences">Preferences</TabsTrigger>
            <TabsTrigger value="preview">Content Preview</TabsTrigger>
          </TabsList>
          
          <TabsContent value="preferences" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Industry & Content</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="industry">Select your industry</Label>
                  <IndustrySelect onSelect={handleIndustrySelect} />
                </div>
                
                <div className="flex items-center space-x-2">
                  <Switch
                    id="auto-generate"
                    checked={autoGenerateEnabled}
                    onCheckedChange={setAutoGenerateEnabled}
                  />
                  <Label htmlFor="auto-generate">
                    Automatically generate and send daily content
                  </Label>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Template Style</CardTitle>
              </CardHeader>
              <CardContent>
                <TemplateSelector 
                  selectedTemplate={selectedTemplate} 
                  onSelectTemplate={setSelectedTemplate} 
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Delivery Preferences</CardTitle>
              </CardHeader>
              <CardContent>
                <TimePreference 
                  deliveryTime={deliveryTime} 
                  onTimeChange={setDeliveryTime}
                  timezone={timezone}
                  onTimezoneChange={setTimezone}
                />
              </CardContent>
            </Card>

            {userEmail ? (
              <Button 
                onClick={handleSubscribe}
                disabled={isSubscribing || !selectedIndustry}
                className="w-full bg-[#3b7ff5] hover:bg-[#2b6fe5]"
              >
                {isSubscribing ? "Saving preferences..." : "Save Preferences"}
              </Button>
            ) : (
              <p className="text-center text-[#8E9196]">
                Please sign in to save your preferences
              </p>
            )}
          </TabsContent>
          
          <TabsContent value="preview">
            <Card>
              <CardHeader>
                <CardTitle>Content Preview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-white rounded-lg p-6 shadow-inner">
                  {selectedTemplate === "bullet-points" && (
                    <div className="space-y-4">
                      <h3 className="text-xl font-bold text-gray-800">The hidden cost of cheap clients:</h3>
                      <ul className="list-disc pl-6 space-y-2">
                        <li>More meetings</li>
                        <li>More revisions</li>
                        <li>More drama</li>
                        <li>More scope creep</li>
                        <li>More turnover</li>
                      </ul>
                      <p className="font-medium text-gray-800 pt-2">Your cheapest clients will cost you the most.</p>
                    </div>
                  )}

                  {selectedTemplate === "numbered-list" && (
                    <div className="space-y-4">
                      <h3 className="text-xl font-bold text-gray-800">5 Steps to Effective Time Management:</h3>
                      <ol className="list-decimal pl-6 space-y-2">
                        <li>Prioritize your most important tasks</li>
                        <li>Break large projects into smaller tasks</li>
                        <li>Eliminate distractions during focus time</li>
                        <li>Schedule breaks to maintain productivity</li>
                        <li>Review and adjust your system regularly</li>
                      </ol>
                      <p className="font-medium text-gray-800 pt-2">Master your time to master your business.</p>
                    </div>
                  )}

                  {selectedTemplate === "tips-format" && (
                    <div className="space-y-4">
                      <h3 className="text-xl font-bold text-gray-800">QUICK TIP:</h3>
                      <p className="text-gray-800">Instead of scheduling back-to-back meetings, build in 10-minute buffers between each one.</p>
                      <p className="text-gray-800">This gives you time to:
                        <span className="block pl-4 pt-2">✓ Take notes from the previous meeting</span>
                        <span className="block pl-4">✓ Prepare for the next conversation</span>
                        <span className="block pl-4">✓ Handle urgent emails or messages</span>
                        <span className="block pl-4">✓ Take a mental break</span>
                      </p>
                      <p className="font-medium text-gray-800 pt-2">Small buffers create massive productivity gains.</p>
                    </div>
                  )}
                </div>
                <p className="text-sm text-[#8E9196] mt-4">
                  This is a preview of how your content will be formatted. Actual content will be customized to your selected industry.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Index;
