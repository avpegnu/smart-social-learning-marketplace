'use client';

import { useState, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Input, Badge } from '@shared/ui';
import { useTags } from '@shared/hooks';
import { X, Search, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TagOption {
  id: string;
  name: string;
  slug: string;
}

interface TagSelectorProps {
  selectedTagIds: string[];
  onChange: (tagIds: string[]) => void;
  maxTags?: number;
}

export function TagSelector({ selectedTagIds, onChange, maxTags = 10 }: TagSelectorProps) {
  const t = useTranslations('tags');
  const { data } = useTags();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const allTags: TagOption[] = (data?.data as TagOption[]) ?? [];

  const filteredTags = search
    ? allTags.filter((tag) => tag.name.toLowerCase().includes(search.toLowerCase()))
    : allTags;

  const selectedTags = allTags.filter((tag) => selectedTagIds.includes(tag.id));

  const toggleTag = (tagId: string) => {
    if (selectedTagIds.includes(tagId)) {
      onChange(selectedTagIds.filter((id) => id !== tagId));
    } else if (selectedTagIds.length < maxTags) {
      onChange([...selectedTagIds, tagId]);
    }
  };

  const removeTag = (tagId: string) => {
    onChange(selectedTagIds.filter((id) => id !== tagId));
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      {/* Selected tags */}
      {selectedTags.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {selectedTags.map((tag) => (
            <Badge key={tag.id} variant="secondary" className="gap-1 pr-1">
              {tag.name}
              <button
                type="button"
                onClick={() => removeTag(tag.id)}
                className="hover:bg-muted rounded-full p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Search input — opens dropdown on focus */}
      <div className="relative">
        <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder={t('searchTags')}
          className="pl-9"
        />
      </div>

      {/* Max tags warning */}
      {selectedTagIds.length >= maxTags && (
        <p className="text-muted-foreground mt-1 text-xs">
          {t('maxTagsReached', { max: maxTags })}
        </p>
      )}

      {/* Dropdown */}
      {open && (
        <div className="border-border bg-popover absolute bottom-full z-50 mb-1 max-h-60 w-full overflow-y-auto rounded-lg border shadow-lg">
          {filteredTags.length === 0 ? (
            <div className="text-muted-foreground p-3 text-center text-sm">{t('noTags')}</div>
          ) : (
            filteredTags.map((tag) => {
              const isSelected = selectedTagIds.includes(tag.id);
              const isDisabled = !isSelected && selectedTagIds.length >= maxTags;

              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => !isDisabled && toggleTag(tag.id)}
                  disabled={isDisabled}
                  className={cn(
                    'border-border/50 flex w-full items-center gap-2 border-b px-3 py-2.5 text-left text-sm transition-colors last:border-b-0',
                    isSelected ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-accent',
                    isDisabled && 'cursor-not-allowed opacity-50',
                  )}
                >
                  <div
                    className={cn(
                      'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                      isSelected
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-muted-foreground/30',
                    )}
                  >
                    {isSelected && <Check className="h-3 w-3" />}
                  </div>
                  {tag.name}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
