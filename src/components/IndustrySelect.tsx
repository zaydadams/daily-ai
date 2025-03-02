
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";

interface IndustrySelectProps {
  onSelect: (value: string) => void;
  initialValue?: string;
  placeholder?: string;
  helperText?: string;
}

export function IndustrySelect({ 
  onSelect, 
  initialValue = "", 
  placeholder = "Enter your industry (e.g., Marketing, Real Estate, Finance)",
  helperText = "We'll generate content specifically tailored to your industry. The more specific you are, the more targeted the content will be."
}: IndustrySelectProps) {
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
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        className="w-full"
      />
      <p className="text-sm text-gray-500 mt-1">
        {helperText}
      </p>
    </div>
  );
}
