'use client';

import * as React from 'react';
import { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '../lib/utils';

export interface SelectOption {
  value: string;
  label: string;
  indent?: string;
}

export interface SelectProps {
  options: SelectOption[];
  value?: string;
  onChange?: (e: { target: { value: string; name?: string } }) => void;
  onBlur?: () => void;
  placeholder?: string;
  className?: string;
  id?: string;
  name?: string;
  disabled?: boolean;
}

const Select = React.forwardRef<HTMLButtonElement, SelectProps>(
  ({ options, value, onChange, onBlur, placeholder, className, id, name, disabled }, ref) => {
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const selectedOption = options.find((opt) => opt.value === value);
    const displayLabel = selectedOption
      ? `${selectedOption.indent ?? ''}${selectedOption.label}`
      : placeholder;

    // Close on outside click
    useEffect(() => {
      if (!open) return;
      function handleClick(e: MouseEvent) {
        if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
          setOpen(false);
        }
      }
      document.addEventListener('mousedown', handleClick);
      return () => document.removeEventListener('mousedown', handleClick);
    }, [open]);

    // Close on Escape
    useEffect(() => {
      if (!open) return;
      function handleKey(e: KeyboardEvent) {
        if (e.key === 'Escape') setOpen(false);
      }
      document.addEventListener('keydown', handleKey);
      return () => document.removeEventListener('keydown', handleKey);
    }, [open]);

    const handleSelect = useCallback(
      (optValue: string) => {
        onChange?.({ target: { value: optValue, name } });
        setOpen(false);
        onBlur?.();
      },
      [onChange, onBlur, name],
    );

    return (
      <div ref={containerRef} className="relative">
        {/* Trigger */}
        <button
          ref={ref}
          type="button"
          id={id}
          disabled={disabled}
          onClick={() => !disabled && setOpen((prev) => !prev)}
          className={cn(
            'border-input bg-background text-foreground focus-visible:ring-ring flex h-10 w-full cursor-pointer items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
            !value && 'text-muted-foreground',
            open && 'ring-ring ring-2',
            className,
          )}
        >
          <span className="truncate">{displayLabel}</span>
          <ChevronDown
            className={cn(
              'text-muted-foreground ml-2 h-4 w-4 shrink-0 transition-transform',
              open && 'rotate-180',
            )}
          />
        </button>

        {/* Dropdown */}
        {open && (
          <div className="bg-popover text-popover-foreground border-border animate-in fade-in-0 zoom-in-95 absolute z-50 mt-1 w-full overflow-hidden rounded-lg border shadow-lg">
            <div className="max-h-60 overflow-y-auto p-1">
              {options.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleSelect(opt.value)}
                  className={cn(
                    'hover:bg-accent hover:text-accent-foreground flex w-full cursor-pointer items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors',
                    opt.value === value && 'bg-accent',
                  )}
                >
                  <span>
                    {opt.indent ?? ''}
                    {opt.label}
                  </span>
                  {opt.value === value && <Check className="text-primary h-4 w-4 shrink-0" />}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  },
);
Select.displayName = 'Select';

export { Select };
