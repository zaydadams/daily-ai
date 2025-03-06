
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";

interface IndustrySelectProps {
  onSelect: (value: string) => void;
  initialValue?: string;
}

export function IndustrySelect({ onSelect, initialValue = "" }: IndustrySelectProps) {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    if (initialValue) {
      setValue(initialValue);
    }
  }, [initialValue]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
    if (e.target.value.trim()) {
      onSelect(e.target.value.trim());
    }
  };

  return (
    <div className="mt-1">
      <Input
        placeholder="Enter your industry (e.g., Marketing, Real Estate, Finance)"
        value={value}
        onChange={handleChange}
        className="w-full"
      />
      <p className="text-sm text-gray-500 mt-1">
        We'll generate content specifically tailored to your industry. 
        The more specific you are, the more targeted the content will be.
      </p>
    </div>
  );
}
