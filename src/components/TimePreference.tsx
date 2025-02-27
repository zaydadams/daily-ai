
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useEffect } from "react";

interface TimePreferenceProps {
  deliveryTime: string;
  onTimeChange: (time: string) => void;
  timezone: string;
  onTimezoneChange: (timezone: string) => void;
}

export function TimePreference({ 
  deliveryTime, 
  onTimeChange, 
  timezone, 
  onTimezoneChange 
}: TimePreferenceProps) {
  const [timezones, setTimezones] = useState<string[]>([]);

  useEffect(() => {
    // Get a list of timezones
    // This is a simplified list - in a production app, you might want a more complete list
    const commonTimezones = [
      "America/New_York",
      "America/Chicago",
      "America/Denver",
      "America/Los_Angeles",
      "America/Anchorage",
      "America/Honolulu",
      "America/Phoenix",
      "Europe/London",
      "Europe/Berlin",
      "Europe/Paris",
      "Europe/Rome",
      "Europe/Moscow",
      "Asia/Tokyo",
      "Asia/Shanghai",
      "Asia/Singapore",
      "Australia/Sydney",
      "Pacific/Auckland"
    ];
    
    // Add the user's local timezone if it's not already in the list
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!commonTimezones.includes(userTimezone)) {
      commonTimezones.unshift(userTimezone);
    }
    
    setTimezones(commonTimezones);
  }, []);

  const formatTimezoneLabel = (tz: string) => {
    try {
      const now = new Date();
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        timeZoneName: 'short'
      });
      const parts = formatter.formatToParts(now);
      const tzPart = parts.find(part => part.type === 'timeZoneName')?.value || '';
      
      // Format the timezone name for display
      return `${tz.replace('_', ' ').replace(/\//g, ' / ')} (${tzPart})`;
    } catch {
      return tz;
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="delivery-time">Delivery Time</Label>
        <Input
          id="delivery-time"
          type="time"
          value={deliveryTime}
          onChange={(e) => onTimeChange(e.target.value)}
          className="mt-1"
        />
        <p className="text-sm text-gray-500 mt-1">
          Choose what time you'd like to receive your daily content.
        </p>
      </div>

      <div>
        <Label htmlFor="timezone">Timezone</Label>
        <Select value={timezone} onValueChange={onTimezoneChange}>
          <SelectTrigger id="timezone" className="mt-1">
            <SelectValue placeholder="Select timezone" />
          </SelectTrigger>
          <SelectContent>
            {timezones.map((tz) => (
              <SelectItem key={tz} value={tz}>
                {formatTimezoneLabel(tz)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-sm text-gray-500 mt-1">
          We'll deliver your content according to your local timezone.
        </p>
      </div>
    </div>
  );
}
