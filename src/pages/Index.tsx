
import { useState, useEffect } from "react";
import { IndustrySelect } from "@/components/IndustrySelect";
import { ContentCard } from "@/components/ContentCard";
import { fetchWordPressPosts } from "@/services/WordPressService";
import { useToast } from "@/components/ui/use-toast";

interface WordPressContent {
  topics: Array<{ title: string; description: string }>;
  hooks: Array<{ title: string; description: string }>;
  tips: Array<{ title: string; description: string }>;
}

const Index = () => {
  const [selectedIndustry, setSelectedIndustry] = useState("");
  const [content, setContent] = useState<WordPressContent | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const loadWordPressContent = async () => {
      try {
        const posts = await fetchWordPressPosts();
        
        // Transform WordPress posts into our content format
        const transformedContent: WordPressContent = {
          topics: posts.slice(0, 3).map(post => ({
            title: post.title.rendered.replace(/^&#8211;\s*/, ''),
            description: `→ ${post.excerpt.rendered.replace(/<\/?p>/g, '').slice(0, 100)}...`
          })),
          hooks: posts.slice(3, 6).map(post => ({
            title: post.title.rendered.replace(/^&#8211;\s*/, ''),
            description: `→ ${post.excerpt.rendered.replace(/<\/?p>/g, '').slice(0, 100)}...`
          })),
          tips: posts.slice(6, 9).map(post => ({
            title: post.title.rendered.replace(/^&#8211;\s*/, ''),
            description: `→ ${post.excerpt.rendered.replace(/<\/?p>/g, '').slice(0, 100)}...`
          }))
        };

        setContent(transformedContent);
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
