
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
  const [isSendingNow, setIsSendingNow] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState("bullet-points-style-x-style");
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

  const handleSendEmailNow = async () => {
    if (!userEmail || !selectedIndustry) {
      toast({
        title: "Error",
        description: !userEmail 
          ? "Please sign in to send email." 
          : "Please select an industry first.",
        variant: "destructive",
      });
      return;
    }

    setIsSendingNow(true);
    try {
      // Call the same function but indicate it's an immediate send
      const { error } = await supabase.functions.invoke('mailchimp-subscribe', {
        body: { 
          email: userEmail, 
          industry: selectedIndustry,
          template: selectedTemplate,
          deliveryTime: deliveryTime,
          timezone: timezone,
          sendNow: true
        },
      });

      if (error) throw error;

      toast({
        title: "Email Sent!",
        description: "Content has been generated and sent to your email.",
      });
    } catch (error) {
      console.error('Error sending email now:', error);
      toast({
        title: "Error",
        description: "Failed to send email. Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsSendingNow(false);
    }
  };

  // Helper to get format and style parts
  const getTemplateParts = () => {
    if (selectedTemplate.includes("-style-")) {
      const [format, style] = selectedTemplate.split("-style-");
      return { format, style };
    }
    return { format: selectedTemplate, style: "x-style" };
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
              <div className="space-y-4">
                <Button 
                  onClick={handleSubscribe}
                  disabled={isSubscribing || !selectedIndustry}
                  className="w-full bg-[#3b7ff5] hover:bg-[#2b6fe5]"
                >
                  {isSubscribing ? "Saving preferences..." : "Save Preferences"}
                </Button>
                
                <Button 
                  onClick={handleSendEmailNow}
                  disabled={isSendingNow || !selectedIndustry}
                  className="w-full bg-[#22c55e] hover:bg-[#16a34a]"
                >
                  {isSendingNow ? "Sending email..." : "Send Email Now"}
                </Button>
              </div>
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
                  {/* X.com style with bullet points */}
                  {getTemplateParts().format === "bullet-points" && getTemplateParts().style === "x-style" && (
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

                  {/* LinkedIn style with bullet points */}
                  {getTemplateParts().format === "bullet-points" && getTemplateParts().style === "linkedin-style" && (
                    <div className="space-y-4">
                      <h3 className="text-xl font-bold text-gray-800">Why Quality Clients Are Essential for Business Growth</h3>
                      <p className="text-gray-600">After 10+ years working with hundreds of clients, I've noticed a consistent pattern that impacts profitability:</p>
                      <ul className="list-disc pl-6 space-y-2">
                        <li>Low-paying clients often require more meeting time and hand-holding</li>
                        <li>They typically request multiple rounds of revisions</li>
                        <li>They create unnecessary interpersonal complications</li>
                        <li>They frequently ask for "just one more thing" outside the agreement</li>
                        <li>They tend to have higher turnover, creating business instability</li>
                      </ul>
                      <p className="font-medium text-gray-800 pt-2">The clients who pay you the least will inevitably cost you the most in time, energy, and opportunity cost. What's been your experience?</p>
                      <p className="text-gray-500 text-sm pt-2">#BusinessStrategy #ClientRelationships #Entrepreneurship</p>
                    </div>
                  )}

                  {/* X.com style with numbered list */}
                  {getTemplateParts().format === "numbered-list" && getTemplateParts().style === "x-style" && (
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

                  {/* LinkedIn style with numbered list */}
                  {getTemplateParts().format === "numbered-list" && getTemplateParts().style === "linkedin-style" && (
                    <div className="space-y-4">
                      <h3 className="text-xl font-bold text-gray-800">The 5-Step Productivity Framework That Transformed My Business</h3>
                      <p className="text-gray-600">After struggling with overwhelm and burnout for years, I developed this system that's helped me and hundreds of my clients take back control of our time:</p>
                      <ol className="list-decimal pl-6 space-y-2">
                        <li><strong>Identify your high-leverage activities</strong> - Focus first on the 20% of work that delivers 80% of your results</li>
                        <li><strong>Use task decomposition</strong> - Break complex projects into concrete, actionable steps of 25-90 minutes each</li>
                        <li><strong>Create distraction-free environments</strong> - Turn off notifications, use focus apps, and communicate boundaries</li>
                        <li><strong>Implement strategic breaks</strong> - Use the Pomodoro technique or similar to maintain peak mental performance</li>
                        <li><strong>Conduct weekly reviews</strong> - Reflect on what worked and what didn't to continuously refine your approach</li>
                      </ol>
                      <p className="font-medium text-gray-800 pt-2">The most successful professionals aren't naturally more productive - they've simply built better systems. What productivity techniques have you found most effective?</p>
                      <p className="text-gray-500 text-sm pt-2">#ProductivityTips #TimeManagement #WorkSmarter</p>
                    </div>
                  )}

                  {/* X.com style with tips format */}
                  {getTemplateParts().format === "tips-format" && getTemplateParts().style === "x-style" && (
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

                  {/* LinkedIn style with tips format */}
                  {getTemplateParts().format === "tips-format" && getTemplateParts().style === "linkedin-style" && (
                    <div className="space-y-4">
                      <h3 className="text-xl font-bold text-gray-800">One Meeting Hack That Saved My Sanity</h3>
                      <p className="text-gray-600">After years of feeling constantly rushed and overwhelmed, I discovered a simple calendar trick that's been a game-changer for my productivity and mental wellbeing:</p>
                      <p className="text-gray-800 font-medium mt-4">PRODUCTIVITY TIP:</p>
                      <p className="text-gray-800">Stop scheduling meetings back-to-back. Instead, add 10-15 minute buffers between every meeting on your calendar.</p>
                      <p className="text-gray-800 mt-3">These intentional gaps allow you to:
                        <span className="block pl-4 pt-2">✓ Document key takeaways while they're fresh in your mind</span>
                        <span className="block pl-4">✓ Review materials for your upcoming conversation</span>
                        <span className="block pl-4">✓ Respond to time-sensitive communications</span>
                        <span className="block pl-4">✓ Reset mentally to be fully present in your next interaction</span>
                        <span className="block pl-4">✓ Handle basic needs like grabbing water or taking a bio break</span>
                      </p>
                      <p className="font-medium text-gray-800 pt-3">I've found that these small breathers between meetings have dramatically improved my meeting effectiveness, reduced stress, and actually allowed me to be more present with clients and team members.</p>
                      <p className="text-gray-600 pt-2">What meeting strategies have made the biggest difference for you?</p>
                      <p className="text-gray-500 text-sm pt-2">#MeetingProductivity #WorkLifeBalance #TimeManagement</p>
                    </div>
                  )}

                  {/* Thought Leadership style examples */}
                  {getTemplateParts().style === "thought-leadership" && (
                    <div className="space-y-4">
                      <h3 className="text-xl font-bold text-gray-800">The 80/20 Rule of Client Selection Most Businesses Get Wrong</h3>
                      <p className="text-gray-600">Industry conventional wisdom has it backward. The focus shouldn't be on getting MORE clients - it should be on identifying and serving the RIGHT clients.</p>
                      
                      {getTemplateParts().format === "bullet-points" && (
                        <ul className="list-disc pl-6 space-y-2 mt-4">
                          <li>Cheap clients don't just pay less - they cost more in emotional labor</li>
                          <li>Premium clients who value expertise make decisions faster</li>
                          <li>A portfolio of ideal clients creates compound growth</li>
                          <li>One toxic client can undo the profit of three good ones</li>
                          <li>Client selection is your most important business filtering system</li>
                        </ul>
                      )}
                      
                      {getTemplateParts().format === "numbered-list" && (
                        <ol className="list-decimal pl-6 space-y-2 mt-4">
                          <li><strong>Price is a filtering mechanism</strong> - Use it strategically to pre-qualify</li>
                          <li><strong>Opportunity cost is real</strong> - Every bad client blocks a potential great one</li>
                          <li><strong>Document red flags</strong> - Create a formal system to identify problem clients early</li>
                          <li><strong>Gracefully exit unprofitable relationships</strong> - Have a referral network ready</li>
                          <li><strong>Focus on lifetime value</strong> - Create experiences worth 10x what you charge</li>
                        </ol>
                      )}
                      
                      {getTemplateParts().format === "tips-format" && (
                        <div className="mt-4">
                          <p className="font-medium text-gray-800">THE CONTRARIAN VIEW:</p>
                          <p className="text-gray-800">Firing your worst client will make you more money than landing a new one.</p>
                          <p className="text-gray-800 mt-3">Here's why:
                            <span className="block pl-4 pt-2">✓ You instantly reclaim hours of unpaid emotional labor</span>
                            <span className="block pl-4">✓ Your team's morale and productivity improves</span>
                            <span className="block pl-4">✓ You create space to serve existing clients better</span>
                            <span className="block pl-4">✓ You open capacity for ideal clients to find you</span>
                            <span className="block pl-4">✓ You regain strategic focus instead of managing problems</span>
                          </p>
                        </div>
                      )}
                      
                      <p className="font-medium text-gray-800 pt-3">The most successful businesses aren't the ones with the most clients - they're the ones with the best clients. This distinction makes all the difference between struggling and thriving.</p>
                    </div>
                  )}

                  {/* Newsletter style examples */}
                  {getTemplateParts().style === "newsletter-style" && (
                    <div className="space-y-4">
                      <h3 className="text-xl font-bold text-gray-800">Hey there,</h3>
                      <p className="text-gray-600">I made a costly mistake last week that I thought might help you avoid the same pitfall...</p>
                      
                      {getTemplateParts().format === "bullet-points" && (
                        <div className="mt-3">
                          <p className="text-gray-800">I said yes to a client project that had several red flags I chose to ignore:</p>
                          <ul className="list-disc pl-6 space-y-2 mt-2">
                            <li>They haggled over my rate from the very first call</li>
                            <li>They wanted multiple revisions to the proposal</li>
                            <li>They had gone through three other consultants this year</li>
                            <li>They needed everything "urgently"</li>
                            <li>They refused to follow my onboarding process</li>
                          </ul>
                        </div>
                      )}
                      
                      {getTemplateParts().format === "numbered-list" && (
                        <div className="mt-3">
                          <p className="text-gray-800">Here's what I've learned about protecting your time and energy:</p>
                          <ol className="list-decimal pl-6 space-y-2 mt-2">
                            <li>Trust your gut when something feels off about a prospect</li>
                            <li>Implement a client filtering system and stick to it</li>
                            <li>Charge enough that you can provide exceptional service</li>
                            <li>Set clear boundaries from the very first interaction</li>
                            <li>Remember that saying no to the wrong clients makes room for the right ones</li>
                          </ol>
                        </div>
                      )}
                      
                      {getTemplateParts().format === "tips-format" && (
                        <div className="mt-3">
                          <p className="text-gray-800">After that experience, here's my new rule:</p>
                          <p className="font-medium text-gray-800 mt-2">THE "SLEEP ON IT" RULE:</p>
                          <p className="text-gray-800">Never agree to a new project during the first call. Always take at least 24 hours to consider if it's truly a good fit.</p>
                          <p className="text-gray-800 mt-3">This simple pause allows you to:
                            <span className="block pl-4 pt-2">✓ Process any subtle red flags you noticed</span>
                            <span className="block pl-4">✓ Consider how the work fits into your current commitments</span>
                            <span className="block pl-4">✓ Check if you're saying yes out of excitement or desperation</span>
                            <span className="block pl-4">✓ Craft a thoughtful proposal rather than a rushed one</span>
                          </p>
                        </div>
                      )}
                      
                      <p className="text-gray-800 pt-3">I hope this helps you avoid the time-drain I experienced this week! Sometimes the most profitable decision is saying "no" to work that doesn't align with your values and vision.</p>
                      <p className="text-gray-800 pt-2">Talk soon,<br />Your Name</p>
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
