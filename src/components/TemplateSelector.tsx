
import { useState, useEffect } from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface TemplateSelectorProps {
  selectedTemplate: string;
  onSelectTemplate: (template: string) => void;
}

export function TemplateSelector({ selectedTemplate, onSelectTemplate }: TemplateSelectorProps) {
  const [activeTab, setActiveTab] = useState<string>("format");
  
  const formatTemplates = [
    {
      id: "bullet-points",
      name: "Bullet Points",
      description: "Organized bullet points with a clear introduction and conclusion."
    },
    {
      id: "numbered-list",
      name: "Numbered List",
      description: "Sequential steps or points in a numbered format."
    },
    {
      id: "tips-format",
      name: "Tips Format",
      description: "A concise tip with check-marked implementation points."
    }
  ];

  const styleTemplates = [
    {
      id: "x-style",
      name: "X.com/Twitter Style",
      description: "Short, impactful statements optimized for social sharing."
    },
    {
      id: "linkedin-style",
      name: "LinkedIn Style",
      description: "Professional, slightly longer content with business insights."
    },
    {
      id: "newsletter-style",
      name: "Newsletter Style",
      description: "Conversational tone with a personal touch, ideal for email."
    },
    {
      id: "thought-leadership",
      name: "Thought Leadership",
      description: "Bold, opinionated takes establishing industry authority."
    }
  ];

  // Handle template selection with format+style combination
  const handleTemplateChange = (value: string) => {
    if (activeTab === "format") {
      // Extract the current style if it exists
      const currentStyle = selectedTemplate.includes("-style-") 
        ? selectedTemplate.split("-style-")[1] 
        : "x-style";
        
      onSelectTemplate(`${value}-style-${currentStyle}`);
    } else {
      // Extract the current format if it exists
      const currentFormat = selectedTemplate.includes("-style-") 
        ? selectedTemplate.split("-style-")[0] 
        : "bullet-points";
        
      onSelectTemplate(`${currentFormat}-style-${value}`);
    }
  };

  // Get the current format and style from the selected template
  const getCurrentFormat = () => {
    if (selectedTemplate.includes("-style-")) {
      return selectedTemplate.split("-style-")[0];
    }
    return selectedTemplate;
  };

  const getCurrentStyle = () => {
    if (selectedTemplate.includes("-style-")) {
      return selectedTemplate.split("-style-")[1];
    }
    return "x-style";
  };

  return (
    <div className="space-y-4">
      <Tabs defaultValue="format" className="mb-4" onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="format">Content Format</TabsTrigger>
          <TabsTrigger value="style">Content Style</TabsTrigger>
        </TabsList>
        
        <TabsContent value="format" className="pt-4">
          <RadioGroup
            value={getCurrentFormat()}
            onValueChange={handleTemplateChange}
            className="space-y-3"
          >
            {formatTemplates.map((template) => (
              <div
                key={template.id}
                className={`flex items-start space-x-3 border rounded-lg p-4 transition-all ${
                  getCurrentFormat() === template.id
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <RadioGroupItem value={template.id} id={`format-${template.id}`} className="mt-1" />
                <div className="flex-1">
                  <Label htmlFor={`format-${template.id}`} className="font-medium text-gray-900 cursor-pointer">
                    {template.name}
                  </Label>
                  <p className="text-sm text-gray-500 mt-1">{template.description}</p>
                </div>
              </div>
            ))}
          </RadioGroup>
        </TabsContent>
        
        <TabsContent value="style" className="pt-4">
          <RadioGroup
            value={getCurrentStyle()}
            onValueChange={handleTemplateChange}
            className="space-y-3"
          >
            {styleTemplates.map((template) => (
              <div
                key={template.id}
                className={`flex items-start space-x-3 border rounded-lg p-4 transition-all ${
                  getCurrentStyle() === template.id
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <RadioGroupItem value={template.id} id={`style-${template.id}`} className="mt-1" />
                <div className="flex-1">
                  <Label htmlFor={`style-${template.id}`} className="font-medium text-gray-900 cursor-pointer">
                    {template.name}
                  </Label>
                  <p className="text-sm text-gray-500 mt-1">{template.description}</p>
                </div>
              </div>
            ))}
          </RadioGroup>
        </TabsContent>
      </Tabs>
    </div>
  );
}
