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
import { AlertTriangle, Mail, CheckCircle, Lock } from "lucide-react";
import { ToneSelector } from "@/components/ToneSelector";
import { SubscriptionManager } from "@/components/SubscriptionManager";
import { AITemperatureSelector } from "@/components/AITemperatureSelector";

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
  const [toneName, setToneName] = useState("professional");
  const [temperature, setTemperature] = useState(0.7);
  const [subscriptionStatus, setSubscriptionStatus] = useState<'active' | 'inactive' | 'expired'>('inactive');
  const { toast } = useToast();

  useEffect(() => {
    // Get the current user's email
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.email) {
        setUserEmail(session.user.email);
        console.log("User is logged in with email:", session.user.email);
        
        // Fetch existing preferences for this user
        fetchUserPreferences(session.user.email);
        
        // If the email matches our admin email, set them as admin
        if (session.user.email === "zaydadams07@gmail.com") {
          setAdminUser(session.user.email);
        }
      } else {
        console.log("No user session found");
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("Auth state changed:", event);
      if (session?.user?.email) {
        setUserEmail(session.user.email);
        // Fetch preferences when user logs in
        fetchUserPreferences(session.user.email);
        
        // If the email matches our admin email, set them as admin
        if (session.user.email === "zaydadams07@gmail.com") {
          setAdminUser(session.user.email);
        }
      } else {
        setUserEmail(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Add function to set user as admin
  const setAdminUser = async (email: string) => {
    try {
      console.log("Setting admin status for:", email);
      const { error } = await supabase.functions.invoke('set-admin-user', {
        body: { email }
      });
      
      if (error) {
        console.error("Error setting admin status:", error);
        return;
      }
      
      // Force refresh subscription status
      setSubscriptionStatus('active');
      console.log(`${email} set as admin with active subscription`);
      
      toast({
        title: "Admin Access Granted",
        description: "You have been granted admin access with full features.",
        duration: 5000,
      });
    } catch (error) {
      console.error('Error setting admin user:', error);
    }
  };

  const fetchUserPreferences = async (email: string) => {
    try {
      console.log("Fetching preferences for:", email);
      const { data, error } = await supabase
        .from('user_industry_preferences')
        .select('*')
        .eq('email', email)
        .single();
        
      if (error) {
        console.error("Error fetching preferences:", error);
        return;
      }
      
      if (data) {
        console.log("Found existing preferences:", data);
        setSelectedIndustry(data.industry || "");
        setSelectedTemplate(data.template || "bullet-points-style-x-style");
        setDeliveryTime(data.delivery_time || "09:00");
        setTimezone(data.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone);
        setAutoGenerateEnabled(data.auto_generate !== null ? data.auto_generate : true);
        setToneName(data.tone_name || "professional");
        setTemperature(data.temperature || 0.7);
      }
    } catch (error) {
      console.error('Error fetching user preferences:', error);
    }
  };

  const handleIndustrySelect = (industry: string) => {
    setSelectedIndustry(industry);
    console.log("Selected industry:", industry);
  };

  const handleToneSelect = (tone: string) => {
    setToneName(tone);
    console.log("Selected tone:", tone);
  };

  const handleSubscriptionStatusChange = (status: 'active' | 'inactive' | 'expired') => {
    setSubscriptionStatus(status);
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

    // Check subscription status for paid features
    if (subscriptionStatus !== 'active') {
      setActiveTab("subscription");
      toast({
        title: "Subscription Required",
        description: "Please subscribe to a plan to save your preferences and generate content.",
        variant: "destructive",
      });
      return;
    }

    setIsSubscribing(true);
    try {
      console.log("Saving preferences for:", userEmail);
      
      // Save to Supabase
      const { error: upsertError } = await supabase
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
            tone_name: toneName,
            temperature: temperature,
          }
        ], { onConflict: 'user_id' });
        
      if (upsertError) {
        console.error("Error saving preferences:", upsertError);
        throw upsertError;
      }

      // Call edge function to register the preferences
      const { error } = await supabase.functions.invoke('mailchimp-subscribe', {
        body: { 
          email: userEmail, 
          industry: selectedIndustry,
          template: selectedTemplate,
          deliveryTime: deliveryTime,
          timezone: timezone,
          autoGenerate: autoGenerateEnabled,
          toneName: toneName,
          temperature: temperature,
        },
      });

      if (error) {
        console.error("Function error:", error);
        throw error;
      }

      // If auto-generate is enabled, trigger today's email if it's within delivery window
      if (autoGenerateEnabled) {
        const now = new Date();
        const currentTimeStr = now.toTimeString().substring(0, 5); // Get current time in HH:MM format
        
        // Check if current time is within 30 minutes of scheduled delivery time
        // This is to avoid sending emails too far from the scheduled time
        const deliveryHour = parseInt(deliveryTime.split(':')[0]);
        const deliveryMinute = parseInt(deliveryTime.split(':')[1]);
        const currentHour = parseInt(currentTimeStr.split(':')[0]);
        const currentMinute = parseInt(currentTimeStr.split(':')[1]);
        
        const currentTotalMinutes = currentHour * 60 + currentMinute;
        const deliveryTotalMinutes = deliveryHour * 60 + deliveryMinute;
        const minutesDifference = Math.abs(currentTotalMinutes - deliveryTotalMinutes);
        
        // If we're within 30 minutes of delivery time or we're past delivery time for today
        if (minutesDifference <= 30 || currentTotalMinutes > deliveryTotalMinutes) {
          try {
            // Show toast that we're processing today's email
            toast({
              title: "Processing Today's Email",
              description: "Since you've just set up or changed your preferences, we're preparing today's content delivery.",
              duration: 5000,
            });
            
            // Call the send-scheduled-emails function to force today's email
            const { error: scheduleError } = await supabase.functions.invoke('send-scheduled-emails', {
              body: { 
                users: [{
                  email: userEmail,
                  industry: selectedIndustry,
                  template: selectedTemplate,
                  timezone: timezone,
                  auto_generate: autoGenerateEnabled,
                  tone_name: toneName,
                  temperature: temperature
                }],
                forceSendToday: true
              },
            });
            
            if (scheduleError) {
              console.error("Error sending today's scheduled email:", scheduleError);
              // Don't throw error here, as preferences were saved successfully
            } else {
              toast({
                title: "Today's Email Scheduled",
                description: "Your first content has been scheduled for delivery today.",
                duration: 5000,
              });
            }
          } catch (scheduleError) {
            console.error("Error scheduling today's email:", scheduleError);
            // Don't throw error here, as preferences were saved successfully
          }
        }
      }

      toast({
        title: "Success!",
        description: autoGenerateEnabled 
          ? "Your preferences have been saved. You'll receive daily content at " + deliveryTime + " in your timezone."
          : "Your preferences have been saved. Auto-generation is disabled, but you can send content manually.",
        duration: 5000,
      });
    } catch (error) {
      console.error('Error subscribing:', error);
      toast({
        title: "Error",
        description: `Failed to save preferences: ${error.message || "Unknown error"}`,
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

    // Check subscription status for paid features
    if (subscriptionStatus !== 'active') {
      setActiveTab("subscription");
      toast({
        title: "Subscription Required",
        description: "Please subscribe to a plan to generate content.",
        variant: "destructive",
      });
      return;
    }

    setIsSendingNow(true);
    try {
      console.log("Sending email request with:", {
        email: userEmail,
        industry: selectedIndustry,
        template: selectedTemplate,
        deliveryTime,
        timezone,
        toneName,
        temperature,
        sendNow: true
      });

      // Show initial toast that we're generating content
      toast({
        title: "Generating Content",
        description: "Creating customized content for your industry. This may take a few seconds...",
      });

      // Call the function with sendNow flag
      const { data, error } = await supabase.functions.invoke('mailchimp-subscribe', {
        body: { 
          email: userEmail, 
          industry: selectedIndustry,
          template: selectedTemplate,
          deliveryTime: deliveryTime,
          timezone: timezone,
          toneName: toneName,
          temperature: temperature,
          sendNow: true
        },
      });

      if (error) {
        console.error("Function error:", error);
        throw error;
      }

      console.log("Email function response:", data);

      // Success toast with more details
      toast({
        title: "Email Sent!",
        description: `Content has been generated and sent to ${userEmail}. Please check your inbox (and spam folder).`,
        duration: 6000,
      });

      // Show content preview
      if (data?.emailContent) {
        setTimeout(() => {
          toast({
            title: "Content Preview",
            description: data.emailContent,
            duration: 8000,
          });
        }, 1000);
      }
      
      // Also show a spam folder reminder
      setTimeout(() => {
        toast({
          title: "Important Reminder",
          description: "If you don't see the email, please check your spam or junk folder and mark it as 'not spam'.",
          duration: 8000,
        });
      }, 3000);
      
    } catch (error) {
      console.error('Error sending email now:', error);
      toast({
        title: "Error",
        description: `Failed to send email: ${error.message || "Unknown error"}`,
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

  // Get tone-specific content for previews
  // Define a proper return type to ensure we handle it correctly
  const getToneSpecificContent = (tone: string, contentType: string): string | string[] => {
    switch (tone) {
      case "professional":
        if (contentType === "heading") {
          return "The Strategic Implications of Client Selection:";
        } else if (contentType === "intro") {
          return "Analysis indicates that optimal client selection criteria significantly impact operational efficiency and profitability metrics.";
        } else if (contentType === "closing") {
          return "Implementation of structured client evaluation protocols is strongly recommended.";
        } else if (contentType === "bullet") {
          return ["Increased resource allocation efficiency", "Reduced operational friction", "Enhanced revenue predictability", "Improved team productivity metrics", "Strategic alignment with core business objectives"];
        }
        break;
      
      case "conversational":
        if (contentType === "heading") {
          return "Let's talk about picking the right clients:";
        } else if (contentType === "intro") {
          return "I've noticed something interesting about clients lately, and I thought you might find this helpful too.";
        } else if (contentType === "closing") {
          return "What do you think? Have you had similar experiences with clients?";
        } else if (contentType === "bullet") {
          return ["They're much easier to work with", "You'll spend less time on revisions", "Projects flow more smoothly", "Your team will thank you", "You'll actually enjoy your work more"];
        }
        break;
      
      case "enthusiastic":
        if (contentType === "heading") {
          return "Transform Your Business With Amazing Clients!";
        } else if (contentType === "intro") {
          return "I'm SO excited to share this game-changing insight that completely revolutionized my business!";
        } else if (contentType === "closing") {
          return "Try this strategy TODAY and watch your business SOAR to new heights!";
        } else if (contentType === "bullet") {
          return ["They ENERGIZE your entire team!", "Projects finish in RECORD time!", "Referrals start POURING in!", "Your work becomes INCREDIBLY fulfilling!", "Profits SKYROCKET almost immediately!"];
        }
        break;
      
      case "humorous":
        if (contentType === "heading") {
          return "The Client Survival Guide: Choose Wisely or Die Trying";
        } else if (contentType === "intro") {
          return "Ever felt like some clients were sent specifically to test your will to live? Let's fix that.";
        } else if (contentType === "closing") {
          return "Remember: life's too short for bad clients. That's why it feels so long sometimes.";
        } else if (contentType === "bullet") {
          return ["Your hair will stop falling out", "Your eye twitch might finally go away", "You'll stop having nightmares about email notifications", "Your therapist will miss you", "You might actually take a vacation that doesn't involve hiding from calls"];
        }
        break;
      
      default: // custom or any other tone
        if (contentType === "heading") {
          return "Finding Your Ideal Client Match";
        } else if (contentType === "intro") {
          return "Based on research and experience, the quality of clients you choose has a substantial impact on your business success.";
        } else if (contentType === "closing") {
          return "Consider implementing a structured approach to client selection to improve your overall business experience.";
        } else if (contentType === "bullet") {
          return ["Better alignment with your values", "Improved workflow efficiency", "Higher satisfaction rates", "Increased referral opportunities", "Enhanced long-term profitability"];
        }
    }
    
    // Default return values for each content type
    if (contentType === "bullet") {
      return ["Item 1", "Item 2", "Item 3", "Item 4", "Item 5"];
    }
    return contentType === "heading" ? "Content Heading" : 
           contentType === "intro" ? "Content introduction." : 
           "Content closing.";
  };

  // Helper function to ensure bullet points are always returned as an array
  const getBulletPoints = (tone: string): string[] => {
    const content = getToneSpecificContent(tone, "bullet");
    // Ensure we always return an array
    return Array.isArray(content) ? content : ["Item 1", "Item 2", "Item 3", "Item 4", "Item 5"];
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
          
          {userEmail && (
            <div className="mt-2 text-green-400 text-sm font-medium">
              Logged in as: {userEmail}
            </div>
          )}
        </div>

        <Tabs defaultValue="preferences" className="mb-8" onValueChange={setActiveTab} value={activeTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="preferences">Preferences</TabsTrigger>
            <TabsTrigger value="preview">Content Preview</TabsTrigger>
            <TabsTrigger value="subscription">Subscription</TabsTrigger>
          </TabsList>
          
          <TabsContent value="preferences" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Industry & Content</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="industry">Select your industry</Label>
                  <IndustrySelect onSelect={handleIndustrySelect} initialValue={selectedIndustry} />
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
                <CardTitle>Tone of Voice</CardTitle>
              </CardHeader>
              <CardContent>
                <ToneSelector onSelect={handleToneSelect} initialValue={toneName} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>AI Temperature</CardTitle>
              </CardHeader>
              <CardContent>
                <AITemperatureSelector 
                  temperature={temperature} 
                  onTemperatureChange={setTemperature} 
                />
                
                {subscriptionStatus !== 'active' && (
                  <div className="mt-4 p-3 bg-gray-100 border rounded-md flex items-center space-x-2">
                    <Lock className="h-4 w-4 text-gray-500" />
                    <span className="text-sm text-gray-600">
                      Subscribe to adjust AI temperature for more creative or precise content
                    </span>
                  </div>
                )}
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
                  className="w-full"
                >
                  {isSubscribing ? "Saving preferences..." : "Save Preferences"}
                </Button>
                
                <Button 
                  onClick={handleSendEmailNow}
                  disabled={isSendingNow || !selectedIndustry}
                  variant="success"
                  className="w-full text-base font-semibold py-6"
                >
                  {isSendingNow ? "Sending email..." : "Send Email Now"}
                </Button>
                
                {subscriptionStatus !== 'active' && (
                  <p className="text-center text-amber-400 text-sm flex items-center justify-center">
                    <AlertTriangle className="h-4 w-4 mr-1" />
                    Subscribe to unlock all features
                  </p>
                )}
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
                      <h3 className="text-xl font-bold text-gray-800">{getToneSpecificContent(toneName, "heading")}</h3>
                      <ul className="list-disc pl-6 space-y-2">
                        {getBulletPoints(toneName).map((item, index) => (
                          <li key={index}>{item}</li>
                        ))}
                      </ul>
                      <p className="font-medium text-gray-800 pt-2">{getToneSpecificContent(toneName, "closing")}</p>
                    </div>
                  )}

                  {/* LinkedIn style with bullet points */}
                  {getTemplateParts().format === "bullet-points" && getTemplateParts().style === "linkedin-style" && (
                    <div className="space-y-4">
                      <h3 className="text-xl font-bold text-gray-800">{getToneSpecificContent(toneName, "heading")}</h3>
                      <p className="text-gray-600">{getToneSpecificContent(toneName, "intro")}</p>
                      <ul className="list-disc pl-6 space-y-2">
                        {getBulletPoints(toneName).map((item, index) => (
                          <li key={index}>{item}</li>
                        ))}
                      </ul>
                      <p className="font-medium text-gray-800 pt-2">{getToneSpecificContent(toneName, "closing")}</p>
                      <p className="text-gray-500 text-sm pt-2">#BusinessStrategy #ClientRelationships #Entrepreneurship</p>
                    </div>
                  )}

                  {/* X.com style with numbered list */}
                  {getTemplateParts().format === "numbered-list" && getTemplateParts().style === "x-style" && (
                    <div className="space-y-4">
                      <h3 className="text-xl font-bold text-gray-800">{getToneSpecificContent(toneName, "heading")}</h3>
                      <ol className="list-decimal pl-6 space-y-2">
                        {getBulletPoints(toneName).map((item, index) => (
                          <li key={index}>{item}</li>
                        ))}
                      </ol>
                      <p className="font-medium text-gray-800 pt-2">{getToneSpecificContent(toneName, "closing")}</p>
                    </div>
                  )}

                  {/* LinkedIn style with numbered list */}
                  {getTemplateParts().format === "numbered-list" && getTemplateParts().style === "linkedin-style" && (
                    <div className="space-y-4">
                      <h3 className="text-xl font-bold text-gray-800">{getToneSpecificContent(toneName, "heading")}</h3>
                      <p className="text-gray-600">{getToneSpecificContent(toneName, "intro")}</p>
                      <ol className="list-decimal pl-6 space-y-2">
                        {getBulletPoints(toneName).map((item, index) => (
                          <li key={index}><strong>Key point {index + 1}</strong> - {item}</li>
                        ))}
                      </ol>
                      <p className="font-medium text-gray-800 pt-2">{getToneSpecificContent(toneName, "closing")}</p>
                      <p className="text-gray-500 text-sm pt-2">#ProductivityTips #TimeManagement #WorkSmarter</p>
                    </div>
                  )}

                  {/* X.com style with tips format */}
                  {getTemplateParts().format === "tips-format" && getTemplateParts().style === "x-style" && (
                    <div className="space-y-4">
                      <h3 className="text-xl font-bold text-gray-800">{getToneSpecificContent(toneName, "heading")}</h3>
                      <p className="text-gray-800">{getToneSpecificContent(toneName, "intro")}</p>
                      <p className="text-gray-800">Key points to consider:
                        {getBulletPoints(toneName).map((item, index) => (
                          <span key={index} className="block pl-4 pt-2">✓ {item}</span>
                        ))}
                      </p>
                      <p className="font-medium text-gray-800 pt-2">{getToneSpecificContent(toneName, "closing")}</p>
                    </div>
                  )}

                  {/* LinkedIn style with tips format */}
                  {getTemplateParts().format === "tips-format" && getTemplateParts().style === "linkedin-style" && (
                    <div className="space-y-4">
                      <h3 className="text-xl font-bold text-gray-800">{getToneSpecificContent(toneName, "heading")}</h3>
                      <p className="text-gray-600">{getToneSpecificContent(toneName, "intro")}</p>
                      <p className="text-gray-800 font-medium mt-4">PROFESSIONAL TIP:</p>
                      <p className="text-gray-800">Consider these important factors:
                        {getBulletPoints(toneName).map((item, index) => (
                          <span key={index} className="block pl-4 pt-2">✓ {item}</span>
                        ))}
                      </p>
                      <p className="font-medium text-gray-800 pt-3">{getToneSpecificContent(toneName, "closing")}</p>
                      <p className="text-gray-500 text-sm pt-2">#MeetingProductivity #WorkLifeBalance #TimeManagement</p>
                    </div>
                  )}

                  {/* Thought Leadership style examples */}
                  {getTemplateParts().style === "thought-leadership" && (
                    <div className="space-y-4">
                      <h3 className="text-xl font-bold text-gray-800">{getToneSpecificContent(toneName, "heading")}</h3>
                      <p className="text-gray-600">{getToneSpecificContent(toneName, "intro")}</p>
                      
                      {getTemplateParts().format === "bullet-points" && (
                        <ul className="list-disc pl-6 space-y-2 mt-4">
                          {getBulletPoints(toneName).map((item, index) => (
                            <li key={index}>{item}</li>
                          ))}
                        </ul>
                      )}
                      
                      {getTemplateParts().format === "numbered-list" && (
                        <ol className="list-decimal pl-6 space-y-2 mt-4">
                          {getBulletPoints(toneName).map((item, index) => (
                            <li key={index}><strong>Point {index + 1}:</strong> {item}</li>
                          ))}
                        </ol>
                      )}
                      
                      {getTemplateParts().format === "tips-format" && (
                        <div className="mt-4">
                          <p className="font-medium text-gray-800">KEY INSIGHTS:</p>
                          <p className="text-gray-800">{getToneSpecificContent(toneName, "intro")}</p>
                          <p className="text-gray-800 mt-3">Consider these factors:
                            {getBulletPoints(toneName).map((item, index) => (
                              <span key={index} className="block pl-4 pt-2">✓ {item}</span>
                            ))}
                          </p>
                        </div>
                      )}
                      
                      <p className="font-medium text-gray-800 pt-3">{getToneSpecificContent(toneName, "closing")}</p>
                    </div>
                  )}

                  {/* Newsletter style examples */}
                  {getTemplateParts().style === "newsletter-style" && (
                    <div className="space-y-4">
                      <h3 className="text-xl font-bold text-gray-800">Hey there,</h3>
                      <p className="text-gray-600">{getToneSpecificContent(toneName, "intro")}</p>
                      
                      {getTemplateParts().format === "bullet-points" && (
                        <div className="mt-3">
                          <p className="text-gray-800">Here are some key insights I've gathered:</p>
                          <ul className="list-disc pl-6 space-y-2 mt-2">
                            {getBulletPoints(toneName).map((item, index) => (
                              <li key={index}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      {getTemplateParts().format === "numbered-list" && (
                        <div className="mt-3">
                          <p className="text-gray-800">Here's what I've learned about this topic:</p>
                          <ol className="list-decimal pl-6 space-y-2 mt-2">
                            {getBulletPoints(toneName).map((item, index) => (
                              <li key={index}>{item}</li>
                            ))}
                          </ol>
                        </div>
                      )}
                      
                      {getTemplateParts().format === "tips-format" && (
                        <div className="mt-3">
                          <p className="text-gray-800">{getToneSpecificContent(toneName, "heading")}</p>
                          <p className="text-gray-800 mt-3">Here's what I've discovered:
                            {getBulletPoints(toneName).map((item, index) => (
                              <span key={index} className="block pl-4 pt-2">✓ {item}</span>
                            ))}
                          </p>
                        </div>
                      )}
                      
                      <p className="text-gray-800 pt-3">{getToneSpecificContent(toneName, "closing")}</p>
                      <p className="text-gray-800 pt-2">Talk soon,<br />Your Name</p>
                    </div>
                  )}
                </div>
                <p className="text-sm text-[#8E9196] mt-4">
                  This is a preview of how your content will be formatted using your selected tone. Actual content will be customized to your industry.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="subscription">
            <SubscriptionManager 
              userEmail={userEmail} 
              onSubscriptionStatusChange={handleSubscriptionStatusChange}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Index;
