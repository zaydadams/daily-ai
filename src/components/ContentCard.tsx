
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ContentCardProps {
  title: string;
  items: string[];
}

export function ContentCard({ title, items }: ContentCardProps) {
  return (
    <Card className="animate-fadeIn">
      <CardHeader>
        <CardTitle className="text-lg font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {items.map((item, index) => (
            <li
              key={index}
              className="animate-slideIn"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <p className="text-sm text-gray-600">{item}</p>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
