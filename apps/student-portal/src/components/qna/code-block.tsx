'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Copy, Check } from 'lucide-react';
import { Badge } from '@shared/ui';

interface CodeBlockProps {
  codeSnippet: { language: string; code: string };
}

export function CodeBlock({ codeSnippet }: CodeBlockProps) {
  const t = useTranslations('questionDetail');
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(codeSnippet.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="bg-muted relative mt-3 overflow-hidden rounded-lg border">
      <div className="flex items-center justify-between px-3 py-1.5">
        <Badge variant="outline" className="text-[10px]">
          {codeSnippet.language}
        </Badge>
        <button
          type="button"
          onClick={handleCopy}
          className="text-muted-foreground hover:text-foreground flex cursor-pointer items-center gap-1 text-xs transition-colors"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3" />
              {t('copied')}
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              {t('copy')}
            </>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto p-3 pt-0">
        <code className="text-sm">{codeSnippet.code}</code>
      </pre>
    </div>
  );
}
