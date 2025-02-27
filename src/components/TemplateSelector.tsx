
import { useState } from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

interface TemplateSelectorProps {
  selectedTemplate: string;
  onSelectTemplate: (template: string) => void;
}

export function TemplateSelector({ selectedTemplate, onSelectTemplate }: TemplateSelectorProps) {
  const templates = [
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

  return (
    <div className="space-y-4">
      <RadioGroup
        value={selectedTemplate}
        onValueChange={onSelectTemplate}
        className="space-y-3"
      >
        {templates.map((template) => (
          <div
            key={template.id}
            className={`flex items-start space-x-3 border rounded-lg p-4 transition-all ${
              selectedTemplate === template.id
                ? "border-blue-500 bg-blue-50"
                : "border-gray-200 hover:border-gray-300"
            }`}
          >
            <RadioGroupItem value={template.id} id={template.id} className="mt-1" />
            <div className="flex-1">
              <Label htmlFor={template.id} className="font-medium text-gray-900 cursor-pointer">
                {template.name}
              </Label>
              <p className="text-sm text-gray-500 mt-1">{template.description}</p>
            </div>
          </div>
        ))}
      </RadioGroup>
    </div>
  );
}
