
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
    <Card className="animate-fadeIn">
      <CardHeader>
        <CardTitle className="text-lg font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-4">
          {items.map((item, index) => (
            <li
              key={index}
              className="animate-slideIn"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <p className="text-sm font-medium text-gray-900 mb-1">{item.title}</p>
              <p className="text-sm text-gray-600">{item.description}</p>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
