'use client';

import * as React from 'react';
import { cn } from '../lib/utils';

interface TabsContextValue {
  activeTab: string;
  setActiveTab: (value: string) => void;
}

const TabsContext = React.createContext<TabsContextValue | undefined>(undefined);

function useTabsContext() {
  const context = React.useContext(TabsContext);
  if (!context) throw new Error('Tabs components must be used within a Tabs provider');
  return context;
}

interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
  defaultValue: string;
  value?: string;
  onValueChange?: (value: string) => void;
}

function Tabs({ defaultValue, value, onValueChange, className, children, ...props }: TabsProps) {
  const [internalValue, setInternalValue] = React.useState(defaultValue);
  const activeTab = value ?? internalValue;

  const setActiveTab = React.useCallback(
    (newValue: string) => {
      if (!value) setInternalValue(newValue);
      onValueChange?.(newValue);
    },
    [value, onValueChange],
  );

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      <div className={cn('', className)} {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

function TabsList({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'bg-muted text-muted-foreground inline-flex h-10 items-center justify-center rounded-lg p-1',
        className,
      )}
      role="tablist"
      {...props}
    />
  );
}

interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
}

function TabsTrigger({ className, value, ...props }: TabsTriggerProps) {
  const { activeTab, setActiveTab } = useTabsContext();
  const isActive = activeTab === value;

  return (
    <button
      role="tab"
      aria-selected={isActive}
      className={cn(
        'ring-offset-background focus-visible:ring-ring inline-flex cursor-pointer items-center justify-center rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-all focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50',
        isActive && 'bg-background text-foreground shadow-sm',
        className,
      )}
      onClick={() => setActiveTab(value)}
      {...props}
    />
  );
}

interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
}

function TabsContent({ className, value, ...props }: TabsContentProps) {
  const { activeTab } = useTabsContext();
  if (activeTab !== value) return null;

  return (
    <div
      role="tabpanel"
      className={cn(
        'ring-offset-background focus-visible:ring-ring mt-2 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
        className,
      )}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
