
import { useState, useEffect } from "react";
import { IndustrySelect } from "@/components/IndustrySelect";
import { ContentCard } from "@/components/ContentCard";
import { fetchWordPressPosts } from "@/services/WordPressService";
import { useToast } from "@/components/ui/use-toast";

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

  return (
    <div className="min-h-screen bg-[#020817] py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-[#3b7ff5] mb-4">
            Daily Content Dashboard
          </h1>
          <p className="text-[#8E9196] max-w-2xl mx-auto text-lg">
            Select your industry to get customized topics, hooks, and tips from writer.expert
          </p>
        </div>

        <div className="mb-8 max-w-md mx-auto">
          <IndustrySelect onSelect={handleIndustrySelect} />
        </div>

        {content && (
          <div className="grid gap-8 md:grid-cols-3">
            <ContentCard title="3 DAILY TOPICS" items={content.topics} />
            <ContentCard title="3 DAILY HOOKS" items={content.hooks} />
            <ContentCard title="3 DAILY TIPS" items={content.tips} />
          </div>
        )}

        {!content && (
          <div className="text-center text-[#8E9196] mt-8 text-lg">
            Select an industry to view customized content
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;
