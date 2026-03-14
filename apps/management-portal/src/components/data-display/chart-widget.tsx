'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@shared/ui';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

interface ChartWidgetProps {
  title: string;
  type: 'line' | 'bar' | 'area' | 'pie';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any[];
  dataKeys: { key: string; color: string; name?: string }[];
  xAxisKey?: string;
  height?: number;
  className?: string;
  children?: React.ReactNode;
}

export function ChartWidget({
  title,
  type,
  data,
  dataKeys,
  xAxisKey = 'month',
  height = 300,
  className,
  children,
}: ChartWidgetProps) {
  const renderChart = () => {
    switch (type) {
      case 'line':
        return (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis
              dataKey={xAxisKey}
              className="text-xs"
              tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
            />
            <YAxis className="text-xs" tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--popover)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                color: 'var(--popover-foreground)',
              }}
            />
            <Legend />
            {dataKeys.map((dk) => (
              <Line
                key={dk.key}
                type="monotone"
                dataKey={dk.key}
                stroke={dk.color}
                strokeWidth={2}
                dot={{ fill: dk.color, r: 4 }}
                name={dk.name || dk.key}
              />
            ))}
          </LineChart>
        );
      case 'bar':
        return (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey={xAxisKey} tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }} />
            <YAxis tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--popover)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                color: 'var(--popover-foreground)',
              }}
            />
            <Legend />
            {dataKeys.map((dk) => (
              <Bar
                key={dk.key}
                dataKey={dk.key}
                fill={dk.color}
                radius={[4, 4, 0, 0]}
                name={dk.name || dk.key}
              />
            ))}
          </BarChart>
        );
      case 'area':
        return (
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey={xAxisKey} tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }} />
            <YAxis tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--popover)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                color: 'var(--popover-foreground)',
              }}
            />
            <Legend />
            {dataKeys.map((dk) => (
              <Area
                key={dk.key}
                type="monotone"
                dataKey={dk.key}
                stroke={dk.color}
                fill={dk.color}
                fillOpacity={0.15}
                name={dk.name || dk.key}
              />
            ))}
          </AreaChart>
        );
      case 'pie':
        return (
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={2}
              dataKey={dataKeys[0]?.key || 'value'}
              nameKey="name"
              label={({ name, percent }: { name?: string; percent?: number }) =>
                `${name || ''} ${((percent || 0) * 100).toFixed(0)}%`
              }
            >
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={(entry as Record<string, string>).color || dataKeys[0]?.color || '#2563eb'}
                />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--popover)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                color: 'var(--popover-foreground)',
              }}
            />
          </PieChart>
        );
    }
  };

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base font-medium">{title}</CardTitle>
        {children}
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          {renderChart()}
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
