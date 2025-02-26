
import { useState, useEffect } from "react";
import { IndustrySelect } from "@/components/IndustrySelect";
import { ContentCard } from "@/components/ContentCard";
import { fetchWordPressPosts } from "@/services/WordPressService";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";

interface ContentItem {
  title: string;
  description: string;
}

interface GeneratedContent {
  topics: ContentItem[];
  hooks: ContentItem[];
  tips: ContentItem[];
}

const Index = () => {
  const [selectedIndustry, setSelectedIndustry] = useState("");
  const [content, setContent] = useState<GeneratedContent | null>(null);
  const [email, setEmail] = useState("");
  const [isSubscribing, setIsSubscribing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const loadWordPressContent = async () => {
      try {
        const generatedContent = await fetchWordPressPosts(selectedIndustry);
        setContent(generatedContent);
      } catch (error) {
        console.error('Error loading WordPress content:', error);
        toast({
          title: "Error",
          description: "Failed to load content. Please try again later.",
          variant: "destructive",
        });
      }
    };

    if (selectedIndustry) {
      loadWordPressContent();
    } else {
      setContent(null);
    }
  }, [selectedIndustry, toast]);

  const handleIndustrySelect = (industry: string) => {
    setSelectedIndustry(industry);
  };

  const handleSubscribe = async () => {
    if (!email || !selectedIndustry) {
      toast({
        title: "Error",
        description: "Please enter your email and select an industry first.",
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
            email,
            industry: selectedIndustry,
            user_id: email, // Using email as user_id for simplicity
          }
        ]);

      // Subscribe to Mailchimp
      const { error } = await supabase.functions.invoke('mailchimp-subscribe', {
        body: { email, industry: selectedIndustry },
      });

      if (error) throw error;

      toast({
        title: "Success!",
        description: "You're now subscribed to daily industry updates.",
      });
    } catch (error) {
      console.error('Error subscribing:', error);
      toast({
        title: "Error",
        description: "Failed to subscribe. Please try again later.",
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
            Daily Content Dashboard
          </h1>
          <p className="text-[#8E9196] max-w-2xl mx-auto text-lg">
            Select your industry to get customized topics, hooks, and tips from writer.expert
          </p>
        </div>

        <div className="mb-8 max-w-md mx-auto space-y-4">
          <IndustrySelect onSelect={handleIndustrySelect} />
          
          {selectedIndustry && (
            <div className="flex gap-2 animate-fade-in">
              <Input
                type="email"
                placeholder="Enter your email for daily updates"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1"
              />
              <Button 
                onClick={handleSubscribe}
                disabled={isSubscribing || !email}
                className="whitespace-nowrap bg-[#3b7ff5] hover:bg-[#2b6fe5]"
              >
                {isSubscribing ? "Subscribing..." : "Get Daily Updates"}
              </Button>
            </div>
          )}
        </div>

        {content && (
          <div className="grid gap-8 md:grid-cols-3">
            <ContentCard 
              title="📝 DAILY TOPICS" 
              items={content.topics}
              className="animate-fade-in" 
              style={{ animationDelay: '0ms' }}
            />
            <ContentCard 
              title="🎯 DAILY HOOKS" 
              items={content.hooks}
              className="animate-fade-in" 
              style={{ animationDelay: '150ms' }}
            />
            <ContentCard 
              title="💡 DAILY TIPS" 
              items={content.tips}
              className="animate-fade-in" 
              style={{ animationDelay: '300ms' }}
            />
          </div>
        )}

        {!content && (
          <div className="text-center text-[#8E9196] mt-8 text-lg animate-fade-in">
            Select an industry to view customized content
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;
