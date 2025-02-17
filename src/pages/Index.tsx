
import { useState } from "react";
import { IndustrySelect } from "@/components/IndustrySelect";
import { ContentCard } from "@/components/ContentCard";

// Mock data - this would come from your database
const contentByIndustry = {
  technology: {
    topics: [
      "Latest AI Developments",
      "Cloud Computing Trends",
      "Cybersecurity Best Practices",
    ],
    hooks: [
      "Transform your business with AI",
      "Cut costs with cloud solutions",
      "Protect your digital assets",
    ],
    tips: [
      "Implement zero-trust security",
      "Optimize cloud spending",
      "Stay updated with tech trends",
    ],
  },
  finance: {
    topics: [
      "Investment Strategies",
      "Market Analysis",
      "Risk Management",
    ],
    hooks: [
      "Maximize your returns",
      "Navigate market volatility",
      "Secure your financial future",
    ],
    tips: [
      "Diversify your portfolio",
      "Monitor market indicators",
      "Set clear financial goals",
    ],
  },
  // Add more industries as needed
};

const Index = () => {
  const [selectedIndustry, setSelectedIndustry] = useState("");

  const handleIndustrySelect = (industry: string) => {
    setSelectedIndustry(industry);
  };

  const content = selectedIndustry ? contentByIndustry[selectedIndustry as keyof typeof contentByIndustry] : null;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Daily Content Dashboard
          </h1>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Select your industry to get customized topics, hooks, and tips for your daily emails.
          </p>
        </div>

        <div className="mb-8 max-w-md mx-auto">
          <IndustrySelect onSelect={handleIndustrySelect} />
        </div>

        {content && (
          <div className="grid gap-6 md:grid-cols-3">
            <ContentCard title="Daily Topics" items={content.topics} />
            <ContentCard title="Hooks" items={content.hooks} />
            <ContentCard title="Tips" items={content.tips} />
          </div>
        )}

        {!content && (
          <div className="text-center text-gray-500 mt-8">
            Select an industry to view customized content
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;
