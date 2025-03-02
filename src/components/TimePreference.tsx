
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useEffect } from "react";
import { AlertCircle } from "lucide-react";

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
  const [currentTime, setCurrentTime] = useState<string>("");

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

    // Update current time in selected timezone
    updateCurrentTime();

    // Set up interval to update the current time every minute
    const intervalId = setInterval(updateCurrentTime, 60000);
    
    return () => clearInterval(intervalId);
  }, [timezone]);

  const updateCurrentTime = () => {
    try {
      const now = new Date();
      const options: Intl.DateTimeFormatOptions = {
        timeZone: timezone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      };
      const timeString = new Intl.DateTimeFormat('en-US', options).format(now);
      setCurrentTime(timeString);
    } catch (error) {
      console.error("Error formatting time:", error);
      setCurrentTime("--:--");
    }
  };

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
        <div className="flex items-center space-x-2 text-sm text-gray-500 mt-1">
          <span>Current time in your selected timezone: </span>
          <span className="font-medium">{currentTime}</span>
        </div>
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
      
      <div className="flex items-start p-3 bg-amber-50 border border-amber-200 rounded-md">
        <AlertCircle className="text-amber-500 mr-2 mt-0.5 h-5 w-5 flex-shrink-0" />
        <div className="text-sm text-amber-800">
          <p className="font-medium">Important Note About Scheduled Delivery</p>
          <p className="mt-1">
            After saving your preferences, you'll receive content at your selected time every day. 
            Make sure the auto-generate toggle is enabled for scheduled delivery.
          </p>
        </div>
      </div>
    </div>
  );
}
