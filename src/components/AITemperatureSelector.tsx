
import React from "react";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";

interface AITemperatureSelectorProps {
  temperature: number;
  onTemperatureChange: (value: number) => void;
}

export function AITemperatureSelector({ temperature, onTemperatureChange }: AITemperatureSelectorProps) {
  const handleSliderChange = (values: number[]) => {
    // Slider returns an array, but we only have one handle
    const newValue = values[0];
    onTemperatureChange(newValue);
  };

  // Format temperature for display (0.1 precision)
  const displayTemperature = temperature.toFixed(1);
  
  // Map temperature values to descriptive terms
  const getTemperatureDescription = (temp: number): string => {
    if (temp <= 0.3) return "Precise & Focused";
    if (temp <= 0.6) return "Balanced";
    if (temp <= 0.8) return "Creative";
    return "Highly Creative";
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <Label htmlFor="temperature-slider" className="text-sm font-medium">
          AI Temperature: {displayTemperature}
        </Label>
        <span className="text-sm text-muted-foreground">
          {getTemperatureDescription(temperature)}
        </span>
      </div>

      <Slider
        id="temperature-slider"
        defaultValue={[temperature]}
        max={1}
        min={0}
        step={0.1}
        onValueChange={handleSliderChange}
        className="w-full"
      />

      <div className="grid grid-cols-3 text-xs text-muted-foreground mt-1">
        <div className="text-left">Precise</div>
        <div className="text-center">Balanced</div>
        <div className="text-right">Creative</div>
      </div>

      <p className="text-xs text-muted-foreground mt-2">
        Lower values (0.1-0.3) produce more focused, deterministic content. Higher values (0.7-1.0) 
        produce more varied, creative results.
      </p>
    </div>
  );
}
