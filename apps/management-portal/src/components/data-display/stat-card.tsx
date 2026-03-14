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
  const isPositive = change > 0;
  const isNeutral = change === 0;

  return (
    <Card className={cn('', className)}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-muted-foreground text-sm font-medium">{label}</p>
            <p className="text-2xl font-bold">{value}</p>
          </div>
          <div className="bg-primary/10 flex h-12 w-12 items-center justify-center rounded-lg">
            <IconComponent className="text-primary h-6 w-6" />
          </div>
        </div>
        {!isNeutral && (
          <div className="mt-3 flex items-center gap-1 text-xs">
            {isPositive ? (
              <TrendingUp className="text-success h-3 w-3" />
            ) : (
              <TrendingDown className="text-destructive h-3 w-3" />
            )}
            <span className={cn(isPositive ? 'text-success' : 'text-destructive')}>
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
