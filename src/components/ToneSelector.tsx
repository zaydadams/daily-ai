
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

  return (
    <div className="space-y-4">
      <RadioGroup value={selectedTone} onValueChange={handleToneChange} className="gap-3">
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="professional" id="professional" />
          <Label htmlFor="professional" className="cursor-pointer">Professional</Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="conversational" id="conversational" />
          <Label htmlFor="conversational" className="cursor-pointer">Conversational</Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="enthusiastic" id="enthusiastic" />
          <Label htmlFor="enthusiastic" className="cursor-pointer">Enthusiastic</Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="humorous" id="humorous" />
          <Label htmlFor="humorous" className="cursor-pointer">Humorous</Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="custom" id="custom" />
          <Label htmlFor="custom" className="cursor-pointer">Custom tone</Label>
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
      
      <div className="mt-2">
        <p className="text-sm text-gray-500">
          The tone of voice affects how your content comes across to readers.
          {selectedTone === "professional" && " Professional tone is formal, authoritative, and polished."}
          {selectedTone === "conversational" && " Conversational tone is friendly, approachable, and easy to understand."}
          {selectedTone === "enthusiastic" && " Enthusiastic tone is energetic, positive, and exciting."}
          {selectedTone === "humorous" && " Humorous tone is light-hearted, witty, and entertaining."}
        </p>
      </div>
    </div>
  );
}
