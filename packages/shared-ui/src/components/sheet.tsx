'use client';

import * as React from 'react';
import { cn } from '../lib/utils';
import { X } from 'lucide-react';

interface SheetContextType {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const SheetContext = React.createContext<SheetContextType>({ open: false, setOpen: () => {} });

function Sheet({
  children,
  open: controlledOpen,
  onOpenChange,
}: {
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  return <SheetContext.Provider value={{ open, setOpen }}>{children}</SheetContext.Provider>;
}

function SheetTrigger({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { setOpen } = React.useContext(SheetContext);
  return (
    <button className={cn('cursor-pointer', className)} onClick={() => setOpen(true)} {...props}>
      {children}
    </button>
  );
}

function SheetContent({
  children,
  className,
  side = 'right',
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { side?: 'left' | 'right' | 'top' | 'bottom' }) {
  const { open, setOpen } = React.useContext(SheetContext);

  if (!open) return null;

  const sideClasses = {
    right: 'inset-y-0 right-0 h-full w-3/4 max-w-sm border-l translate-x-0',
    left: 'inset-y-0 left-0 h-full w-3/4 max-w-sm border-r translate-x-0',
    top: 'inset-x-0 top-0 w-full border-b',
    bottom: 'inset-x-0 bottom-0 w-full border-t',
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50" onClick={() => setOpen(false)} />
      <div
        className={cn(
          'bg-background fixed z-50 p-6 shadow-lg transition-transform',
          sideClasses[side],
          className,
        )}
        {...props}
      >
        <button
          className="ring-offset-background focus:ring-ring absolute top-4 right-4 cursor-pointer rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-none"
          onClick={() => setOpen(false)}
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </button>
        {children}
      </div>
    </>
  );
}

function SheetHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('mb-4 flex flex-col space-y-2 text-center sm:text-left', className)}
      {...props}
    />
  );
}

function SheetTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('text-foreground text-lg font-semibold', className)} {...props} />;
}

function useSheet() {
  const [open, setOpen] = React.useState(false);
  return { open, setOpen, onOpenChange: setOpen };
}

export { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, useSheet };
