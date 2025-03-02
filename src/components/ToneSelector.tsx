
import { useState, useEffect } from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { IndustrySelect } from "@/components/IndustrySelect";

interface ToneSelectorProps {
  onSelect: (value: string) => void;
  initialValue?: string;
}

export function ToneSelector({ onSelect, initialValue = "professional" }: ToneSelectorProps) {
  const [selectedTone, setSelectedTone] = useState<string>(initialValue);
  const [customTone, setCustomTone] = useState<string>("");
  
  useEffect(() => {
    if (initialValue && initialValue !== "custom") {
      setSelectedTone(initialValue);
    } else if (initialValue && initialValue !== "professional" && initialValue !== "conversational" && 
               initialValue !== "enthusiastic" && initialValue !== "humorous") {
      setSelectedTone("custom");
      setCustomTone(initialValue);
    }
  }, [initialValue]);

  const handleToneChange = (value: string) => {
    setSelectedTone(value);
    if (value !== "custom") {
      onSelect(value);
    } else if (customTone) {
      onSelect(customTone);
    }
  };

  const handleCustomToneChange = (value: string) => {
    setCustomTone(value);
    if (selectedTone === "custom") {
      onSelect(value);
    }
  };

  const getToneDescription = (tone: string) => {
    switch (tone) {
      case "professional":
        return "Formal, authoritative, and polished. Ideal for business communications and establishing credibility.";
      case "conversational":
        return "Friendly, approachable, and easy to understand. Great for building rapport and everyday communication.";
      case "enthusiastic":
        return "Energetic, positive, and exciting. Perfect for motivational content and announcements.";
      case "humorous":
        return "Light-hearted, witty, and entertaining. Excellent for engaging content that doesn't take itself too seriously.";
      case "custom":
        return "Define your own unique tone of voice for your content.";
      default:
        return "";
    }
  };

  return (
    <div className="space-y-4">
      <RadioGroup value={selectedTone} onValueChange={handleToneChange} className="gap-3">
        <div className="flex items-start space-x-2">
          <RadioGroupItem value="professional" id="professional" className="mt-1" />
          <div>
            <Label htmlFor="professional" className="cursor-pointer font-medium">Professional</Label>
            <p className="text-sm text-gray-500">{getToneDescription("professional")}</p>
          </div>
        </div>
        
        <div className="flex items-start space-x-2">
          <RadioGroupItem value="conversational" id="conversational" className="mt-1" />
          <div>
            <Label htmlFor="conversational" className="cursor-pointer font-medium">Conversational</Label>
            <p className="text-sm text-gray-500">{getToneDescription("conversational")}</p>
          </div>
        </div>
        
        <div className="flex items-start space-x-2">
          <RadioGroupItem value="enthusiastic" id="enthusiastic" className="mt-1" />
          <div>
            <Label htmlFor="enthusiastic" className="cursor-pointer font-medium">Enthusiastic</Label>
            <p className="text-sm text-gray-500">{getToneDescription("enthusiastic")}</p>
          </div>
        </div>
        
        <div className="flex items-start space-x-2">
          <RadioGroupItem value="humorous" id="humorous" className="mt-1" />
          <div>
            <Label htmlFor="humorous" className="cursor-pointer font-medium">Humorous</Label>
            <p className="text-sm text-gray-500">{getToneDescription("humorous")}</p>
          </div>
        </div>
        
        <div className="flex items-start space-x-2">
          <RadioGroupItem value="custom" id="custom" className="mt-1" />
          <div>
            <Label htmlFor="custom" className="cursor-pointer font-medium">Custom tone</Label>
            <p className="text-sm text-gray-500">{getToneDescription("custom")}</p>
          </div>
        </div>
      </RadioGroup>
      
      {selectedTone === "custom" && (
        <div className="ml-6 mt-2">
          <IndustrySelect 
            onSelect={handleCustomToneChange}
            initialValue={customTone}
            placeholder="Describe your custom tone (e.g., Friendly Expert, Authoritative)"
            helperText="Be specific about how you want your content to sound."
          />
        </div>
      )}
    </div>
  );
}
