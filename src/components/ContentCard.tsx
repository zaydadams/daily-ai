
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ContentItem {
  title: string;
  description: string;
}

interface ContentCardProps {
  title: string;
  items: ContentItem[];
  className?: string;
  style?: React.CSSProperties;
}

export function ContentCard({ title, items, className, style }: ContentCardProps) {
  return (
    <Card 
      className={`transform transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl ${className}`}
      style={style}
    >
      <CardHeader className="border-b border-[#E5DEFF] bg-[#F6F4FF]">
        <CardTitle className="text-lg font-bold text-[#6E59A5] flex items-center justify-center">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <ul className="space-y-8">
          {items.map((item, index) => (
            <li
              key={index}
              className="transform transition-all duration-200 hover:scale-[1.02] hover:bg-[#F6F4FF] p-4 rounded-lg cursor-pointer"
            >
              <p className="text-base font-medium text-[#1A1F2C] mb-3">
                {item.title}
              </p>
              <p className="text-[#8E9196] text-sm">
                {item.description}
              </p>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
