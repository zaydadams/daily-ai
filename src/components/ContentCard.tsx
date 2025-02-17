
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ContentItem {
  title: string;
  description: string;
}

interface ContentCardProps {
  title: string;
  items: ContentItem[];
}

export function ContentCard({ title, items }: ContentCardProps) {
  return (
    <Card className="animate-fadeIn bg-white shadow-lg hover:shadow-xl transition-shadow duration-300">
      <CardHeader className="border-b border-[#E5DEFF] bg-[#F6F4FF]">
        <CardTitle className="text-lg font-bold text-[#6E59A5]">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <ul className="space-y-6">
          {items.map((item, index) => (
            <li
              key={index}
              className="animate-slideIn hover:bg-[#F6F4FF] p-3 rounded-lg transition-colors duration-200"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <p className="text-base font-medium text-[#1A1F2C] mb-2">{item.title}</p>
              <p className="text-[#8E9196]">{item.description}</p>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
