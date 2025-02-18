
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { Button } from "@/components/ui/button";

interface IndustrySelectProps {
  onSelect: (value: string) => void;
}

export function IndustrySelect({ onSelect }: IndustrySelectProps) {
  const [value, setValue] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      onSelect(value.trim());
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <Input
        placeholder="Enter your industry..."
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="flex-1"
      />
      <Button type="submit" disabled={!value.trim()}>
        Get Content
      </Button>
    </form>
  );
}
