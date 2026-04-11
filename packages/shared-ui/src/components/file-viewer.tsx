'use client';

import { useState } from 'react';
import { Download, ExternalLink, FileText, X } from 'lucide-react';
import { Button, buttonVariants } from './button';
import { cn } from '../lib/utils';

export interface FileViewerLabels {
  download: string;
  openInNewTab: string;
  unsupportedFile: string;
  loadingViewer: string;
  close?: string;
}

interface FileViewerProps {
  url: string;
  mimeType: string;
  fileName: string;
  labels: FileViewerLabels;
  /** 'inline' renders in place; 'modal' renders a fullscreen overlay */
  mode?: 'inline' | 'modal';
  onClose?: () => void;
  className?: string;
}

type ViewerType = 'pdf' | 'image' | 'google-docs' | 'text' | 'download';

function resolveViewerType(mimeType: string, url: string): ViewerType {
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType.startsWith('image/')) return 'image';
  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
    mimeType === 'application/msword' ||
    mimeType === 'application/vnd.ms-excel'
  ) {
    // Google Docs Viewer requires a public URL — blob URLs are local-only
    return url.startsWith('blob:') ? 'download' : 'google-docs';
  }
  if (mimeType === 'text/plain' || mimeType === 'text/markdown') return 'text';
  return 'download';
}

export function FileViewer({
  url,
  mimeType,
  fileName,
  labels,
  mode = 'inline',
  onClose,
  className,
}: FileViewerProps) {
  const [textContent, setTextContent] = useState<string | null>(null);
  const [textLoading, setTextLoading] = useState(false);

  const viewerType = resolveViewerType(mimeType, url);

  // Lazy-fetch plain-text files on first render
  if (viewerType === 'text' && textContent === null && !textLoading) {
    setTextLoading(true);
    fetch(url)
      .then((r) => r.text())
      .then((t) => {
        setTextContent(t);
        setTextLoading(false);
      })
      .catch(() => {
        setTextContent('');
        setTextLoading(false);
      });
  }

  // Google Docs Viewer works with any publicly accessible URL (Cloudinary URLs are public)
  const googleDocsUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`;

  const toolbar = (
    <div className="border-border flex shrink-0 items-center justify-between border-b px-4 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <FileText className="text-muted-foreground h-4 w-4 shrink-0" />
        <span className="truncate text-sm font-medium">{fileName}</span>
      </div>
      <div className="ml-2 flex shrink-0 items-center gap-1">
        <a
          href={url}
          download={fileName}
          className={buttonVariants({ variant: 'outline', size: 'sm' })}
        >
          <Download className="mr-1 h-3 w-3" />
          {labels.download}
        </a>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          title={labels.openInNewTab}
          className={buttonVariants({ variant: 'ghost', size: 'icon' })}
        >
          <ExternalLink className="h-3 w-3" />
        </a>
        {mode === 'modal' && onClose && (
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );

  const viewerArea = (
    <div className="bg-muted/30 min-h-0 flex-1 overflow-hidden">
      {viewerType === 'pdf' && (
        <iframe src={googleDocsUrl} className="h-full w-full border-0" title={fileName} />
      )}

      {viewerType === 'google-docs' && (
        <iframe src={googleDocsUrl} className="h-full w-full border-0" title={fileName} />
      )}

      {viewerType === 'image' && (
        <div className="flex h-full items-center justify-center p-4">
          <img src={url} alt={fileName} className="max-h-full max-w-full object-contain" />
        </div>
      )}

      {viewerType === 'text' && (
        <div className="h-full overflow-auto p-4">
          {textLoading ? (
            <p className="text-muted-foreground text-sm">{labels.loadingViewer}</p>
          ) : (
            <pre className="font-mono text-sm whitespace-pre-wrap">{textContent}</pre>
          )}
        </div>
      )}

      {viewerType === 'download' && (
        <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
          <FileText className="text-muted-foreground/50 h-16 w-16" />
          <p className="text-muted-foreground text-sm">{labels.unsupportedFile}</p>
          <a href={url} download={fileName} className={buttonVariants({ variant: 'default' })}>
            <Download className="mr-2 h-4 w-4" />
            {labels.download}
          </a>
        </div>
      )}
    </div>
  );

  const content = (
    <div className={cn('flex flex-col', mode === 'inline' ? 'h-full' : 'h-[80vh]', className)}>
      {toolbar}
      {viewerArea}
    </div>
  );

  if (mode === 'modal') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
        <div className="bg-background border-border h-[85vh] w-full max-w-5xl overflow-hidden rounded-xl border shadow-2xl">
          {content}
        </div>
      </div>
    );
  }

  return content;
}
