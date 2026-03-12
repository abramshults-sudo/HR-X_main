import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface SectionCardProps {
  title: string;
  children: React.ReactNode;
  className?: string;
  icon?: React.ReactNode;
}

export const SectionCard = ({ title, children, className, icon }: SectionCardProps) => {
  return (
    <Card className={cn("border border-border", className)}>
      <CardHeader>
        <CardTitle className={icon ? "flex items-center gap-2" : undefined}>
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  );
};
