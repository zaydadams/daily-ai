
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

interface TemplateSelectorProps {
  selectedTemplate: string;
  onSelectTemplate: (template: string) => void;
}

export function TemplateSelector({ selectedTemplate, onSelectTemplate }: TemplateSelectorProps) {
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
    }
  ];

  // Handle style selection
  const handleStyleChange = (value: string) => {
    onSelectTemplate(`bullet-points-style-${value}`);
  };

  // Get the current style from the selected template
  const getCurrentStyle = () => {
    if (selectedTemplate.includes("-style-")) {
      return selectedTemplate.split("-style-")[1];
    }
    return "x-style";
  };

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-base font-medium text-gray-900 mb-3">Content Style</h3>
        <RadioGroup
          value={getCurrentStyle()}
          onValueChange={handleStyleChange}
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
      </div>
    </div>
  );
}

