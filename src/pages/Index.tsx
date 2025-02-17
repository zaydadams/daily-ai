
import { useState } from "react";
import { IndustrySelect } from "@/components/IndustrySelect";
import { ContentCard } from "@/components/ContentCard";

const contentByIndustry = {
  technology: {
    topics: [
      {
        title: "Explore AI Implementation Strategies",
        description: "→ Share practical examples and case studies",
      },
      {
        title: "Discuss Cloud Migration Challenges",
        description: "→ Present solutions and best practices",
      },
      {
        title: "Review Cybersecurity Trends",
        description: "→ Analyze recent security incidents and lessons learned",
      },
    ],
    hooks: [
      {
        title: "The truth about AI adoption in enterprise",
        description: "→ Debunking common misconceptions about AI implementation",
      },
      {
        title: "5 overlooked strategies to master cloud computing",
        description: "→ Hidden techniques for optimal cloud performance",
      },
      {
        title: "If your goal is digital transformation, stop doing this",
        description: "→ Critical mistakes to avoid in tech modernization",
      },
    ],
    tips: [
      {
        title: "Start Small",
        description: "→ Begin with pilot projects before full implementation",
      },
      {
        title: "Measure Impact",
        description: "→ Track and analyze key performance metrics",
      },
      {
        title: "Foster Collaboration",
        description: "→ Encourage cross-team communication and knowledge sharing",
      },
    ],
  },
  healthcare: {
    topics: [
      {
        title: "Digital Health Integration",
        description: "→ Explore successful implementation stories",
      },
      {
        title: "Patient Care Innovation",
        description: "→ Share breakthrough approaches in care delivery",
      },
      {
        title: "Healthcare Data Management",
        description: "→ Discuss best practices and compliance",
      },
    ],
    hooks: [
      {
        title: "The truth about telemedicine adoption",
        description: "→ Real insights from healthcare providers",
      },
      {
        title: "7 overlooked strategies for patient engagement",
        description: "→ Proven techniques for better outcomes",
      },
      {
        title: "If your goal is better patient care, stop doing this",
        description: "→ Common mistakes in healthcare delivery",
      },
    ],
    tips: [
      {
        title: "Prioritize Privacy",
        description: "→ Ensure HIPAA compliance in all processes",
      },
      {
        title: "Enhance Communication",
        description: "→ Improve patient-provider interactions",
      },
      {
        title: "Streamline Workflows",
        description: "→ Optimize clinical processes for efficiency",
      },
    ],
  },
  finance: {
    topics: [
      {
        title: "Investment Strategy Analysis",
        description: "→ Review current market trends and opportunities",
      },
      {
        title: "Risk Management Approaches",
        description: "→ Discuss modern risk mitigation techniques",
      },
      {
        title: "Digital Banking Evolution",
        description: "→ Explore the future of financial services",
      },
    ],
    hooks: [
      {
        title: "The truth about cryptocurrency investments",
        description: "→ Beyond the hype: real market analysis",
      },
      {
        title: "8 overlooked strategies for wealth building",
        description: "→ Lesser-known approaches to financial growth",
      },
      {
        title: "If your goal is financial freedom, stop doing this",
        description: "→ Common investment mistakes to avoid",
      },
    ],
    tips: [
      {
        title: "Diversify Holdings",
        description: "→ Balance your investment portfolio",
      },
      {
        title: "Monitor Markets",
        description: "→ Stay informed about market movements",
      },
      {
        title: "Plan Long-term",
        description: "→ Develop sustainable financial strategies",
      },
    ],
  },
  education: {
    topics: [
      {
        title: "Online Learning Innovations",
        description: "→ Explore new educational technologies",
      },
      {
        title: "Student Engagement Strategies",
        description: "→ Share effective teaching methods",
      },
      {
        title: "Educational Assessment Tools",
        description: "→ Review modern evaluation approaches",
      },
    ],
    hooks: [
      {
        title: "The truth about remote learning",
        description: "→ Real insights from educators worldwide",
      },
      {
        title: "6 overlooked strategies for student success",
        description: "→ Proven techniques for better learning outcomes",
      },
      {
        title: "If your goal is better grades, stop doing this",
        description: "→ Common study habits to avoid",
      },
    ],
    tips: [
      {
        title: "Personalize Learning",
        description: "→ Adapt content to individual needs",
      },
      {
        title: "Foster Collaboration",
        description: "→ Encourage peer learning and discussion",
      },
      {
        title: "Track Progress",
        description: "→ Monitor and celebrate achievements",
      },
    ],
  },
  retail: {
    topics: [
      {
        title: "E-commerce Optimization",
        description: "→ Share conversion improvement strategies",
      },
      {
        title: "Customer Experience Enhancement",
        description: "→ Discuss loyalty program success stories",
      },
      {
        title: "Retail Tech Integration",
        description: "→ Explore innovative retail solutions",
      },
    ],
    hooks: [
      {
        title: "The truth about online retail success",
        description: "→ Insights from successful e-commerce brands",
      },
      {
        title: "5 overlooked strategies for retail growth",
        description: "→ Hidden opportunities in modern retail",
      },
      {
        title: "If your goal is customer retention, stop doing this",
        description: "→ Common retail mistakes to avoid",
      },
    ],
    tips: [
      {
        title: "Optimize Digital Presence",
        description: "→ Enhance your online storefront",
      },
      {
        title: "Personalize Experience",
        description: "→ Tailor offerings to customer preferences",
      },
      {
        title: "Analyze Data",
        description: "→ Use insights to drive decisions",
      },
    ],
  },
  manufacturing: {
    topics: [
      {
        title: "Smart Factory Implementation",
        description: "→ Share Industry 4.0 success stories",
      },
      {
        title: "Supply Chain Optimization",
        description: "→ Discuss resilient supply strategies",
      },
      {
        title: "Sustainable Manufacturing",
        description: "→ Explore eco-friendly production methods",
      },
    ],
    hooks: [
      {
        title: "The truth about automation in manufacturing",
        description: "→ Real insights from industry leaders",
      },
      {
        title: "7 overlooked strategies for production efficiency",
        description: "→ Hidden opportunities in manufacturing",
      },
      {
        title: "If your goal is lean manufacturing, stop doing this",
        description: "→ Common production mistakes to avoid",
      },
    ],
    tips: [
      {
        title: "Embrace Technology",
        description: "→ Integrate smart manufacturing solutions",
      },
      {
        title: "Train Workforce",
        description: "→ Develop skills for modern manufacturing",
      },
      {
        title: "Monitor Quality",
        description: "→ Implement robust quality control",
      },
    ],
  },
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
            <ContentCard title="3 DAILY TOPICS" items={content.topics} />
            <ContentCard title="3 DAILY HOOKS" items={content.hooks} />
            <ContentCard title="3 DAILY TIPS" items={content.tips} />
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
