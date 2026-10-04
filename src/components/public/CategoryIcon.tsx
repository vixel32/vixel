import { Monitor, FileText, Flower, Gift, Package } from 'lucide-react';

const iconMap: Record<string, typeof Monitor> = {
  monitor: Monitor,
  'file-text': FileText,
  flower: Flower,
  gift: Gift,
  package: Package,
};

export function CategoryIcon({ icon, className }: { icon: string | null; className?: string }) {
  const Icon = iconMap[icon ?? 'package'] ?? Package;
  return <Icon className={className} />;
}
