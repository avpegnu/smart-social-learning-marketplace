'use client';

import { useState, type ComponentPropsWithoutRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Copy, Check } from 'lucide-react';
import { Badge } from '@shared/ui';

function CodeBlock({ className, children, ...props }: ComponentPropsWithoutRef<'code'>) {
  const [copied, setCopied] = useState(false);
  const match = /language-(\w+)/.exec(className ?? '');
  const language = match?.[1] ?? '';
  const codeString = String(children).replace(/\n$/, '');

  // Inline code
  if (!match) {
    return (
      <code className="bg-muted rounded px-1.5 py-0.5 text-sm" {...props}>
        {children}
      </code>
    );
  }

  function handleCopy() {
    navigator.clipboard.writeText(codeString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="bg-muted group relative my-3 overflow-hidden rounded-lg border">
      <div className="flex items-center justify-between px-3 py-1.5">
        <Badge variant="outline" className="text-[10px]">
          {language}
        </Badge>
        <button
          type="button"
          onClick={handleCopy}
          className="text-muted-foreground hover:text-foreground flex cursor-pointer items-center gap-1 text-xs transition-colors"
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        </button>
      </div>
      <pre className="overflow-x-auto px-3 pb-3">
        <code className="text-sm" {...props}>
          {children}
        </code>
      </pre>
    </div>
  );
}

interface MarkdownRendererProps {
  content: string;
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <div className="prose prose-sm dark:prose-invert prose-p:text-foreground prose-li:text-foreground prose-headings:text-foreground prose-strong:text-foreground prose-code:text-foreground max-w-none wrap-break-word">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code: CodeBlock,
          a: ({ children, ...props }) => (
            <a
              {...props}
              className="text-primary hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
