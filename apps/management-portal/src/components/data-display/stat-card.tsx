'use client';

import { cn } from '@/lib/utils';
import { Card, CardContent } from '@shared/ui';
import { DollarSign, Users, BookOpen, Star, Clock, TrendingUp, TrendingDown } from 'lucide-react';

const iconMap: Record<string, React.ElementType> = {
  DollarSign,
  Users,
  BookOpen,
  Star,
  Clock,
};

// Each stat type gets a distinct accent color from the multi-accent palette
const iconColorMap: Record<string, string> = {
  DollarSign: 'bg-accent-emerald/12 text-accent-emerald',
  Users: 'bg-accent-cyan/12 text-accent-cyan',
  BookOpen: 'bg-primary/12 text-primary',
  Star: 'bg-accent-amber/15 text-accent-amber',
  Clock: 'bg-accent-violet/12 text-accent-violet',
};

interface StatCardProps {
  label: string;
  value: string;
  change: number;
  changeLabel: string;
  icon: string;
  className?: string;
}

export function StatCard({ label, value, change, changeLabel, icon, className }: StatCardProps) {
  const IconComponent = iconMap[icon] || DollarSign;
  const iconColor = iconColorMap[icon] || iconColorMap.DollarSign;
  const isPositive = change > 0;
  const isNeutral = change === 0;

  return (
    <Card
      className={cn(
        'hover:border-primary/30 group transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md',
        className,
      )}
    >
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-muted-foreground text-sm font-medium">{label}</p>
            <p className="text-2xl font-bold tracking-tight">{value}</p>
          </div>
          <div
            className={cn(
              'flex h-12 w-12 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110',
              iconColor,
            )}
          >
            <IconComponent className="h-6 w-6" />
          </div>
        </div>
        {!isNeutral && (
          <div className="mt-3 flex items-center gap-1 text-xs">
            {isPositive ? (
              <TrendingUp className="text-success h-3 w-3" />
            ) : (
              <TrendingDown className="text-destructive h-3 w-3" />
            )}
            <span className={cn('font-medium', isPositive ? 'text-success' : 'text-destructive')}>
              {isPositive ? '+' : ''}
              {change}%
            </span>
            <span className="text-muted-foreground">{changeLabel}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
