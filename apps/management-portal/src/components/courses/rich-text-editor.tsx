'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import { useState, useEffect } from 'react';
import { cn } from '@shared/ui';
import {
  Bold,
  Italic,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Link as LinkIcon,
  Undo,
  Redo,
  Eye,
  Code2,
  Pencil,
} from 'lucide-react';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: string;
  readOnly?: boolean;
}

type EditorTab = 'edit' | 'preview' | 'html';

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  minHeight = '200px',
  readOnly = false,
}: RichTextEditorProps) {
  const [activeTab, setActiveTab] = useState<EditorTab>('edit');
  const [htmlSource, setHtmlSource] = useState('');

  const editor = useEditor({
    immediatelyRender: false,
    editable: !readOnly && activeTab === 'edit',
    extensions: [StarterKit, Link.configure({ openOnClick: false })],
    content: value,
    onUpdate: ({ editor: e }) => onChange(e.getHTML()),
    editorProps: {
      attributes: {
        class: cn(
          'prose prose-sm dark:prose-invert prose-p:text-foreground prose-li:text-foreground prose-headings:text-foreground max-w-none break-all p-4 focus:outline-none',
        ),
        style: `min-height: ${minHeight}`,
      },
    },
  });

  // Sync external value changes
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value);
    }
  }, [value]); // editor intentionally omitted to avoid loop

  // Sync HTML source when switching to HTML tab
  useEffect(() => {
    if (activeTab === 'html') {
      setHtmlSource(editor?.getHTML() ?? value);
    }
  }, [activeTab]); // editor/value intentionally omitted

  // Apply HTML source back when leaving HTML tab
  const applyHtmlSource = () => {
    if (editor) {
      editor.commands.setContent(htmlSource);
      onChange(htmlSource);
    }
  };

  if (!editor) return null;

  const switchTab = (tab: EditorTab) => {
    if (activeTab === 'html' && tab !== 'html') {
      applyHtmlSource();
    }
    setActiveTab(tab);
  };

  return (
    <div
      className={cn(
        'border-border bg-background overflow-hidden rounded-md border',
        readOnly && 'opacity-70',
      )}
    >
      {/* Toolbar + Tab switcher */}
      {!readOnly && (
        <div className="border-border flex items-center justify-between border-b p-2">
          {/* Formatting tools (only in edit mode) */}
          <div className="flex flex-wrap gap-1">
            {activeTab === 'edit' && (
              <>
                <ToolbarButton
                  active={editor.isActive('bold')}
                  onClick={() => editor.chain().focus().toggleBold().run()}
                  title="Bold"
                >
                  <Bold className="h-4 w-4" />
                </ToolbarButton>
                <ToolbarButton
                  active={editor.isActive('italic')}
                  onClick={() => editor.chain().focus().toggleItalic().run()}
                  title="Italic"
                >
                  <Italic className="h-4 w-4" />
                </ToolbarButton>
                <ToolbarButton
                  active={editor.isActive('heading', { level: 2 })}
                  onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                  title="Heading 2"
                >
                  <Heading2 className="h-4 w-4" />
                </ToolbarButton>
                <ToolbarButton
                  active={editor.isActive('heading', { level: 3 })}
                  onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                  title="Heading 3"
                >
                  <Heading3 className="h-4 w-4" />
                </ToolbarButton>
                <ToolbarButton
                  active={editor.isActive('bulletList')}
                  onClick={() => editor.chain().focus().toggleBulletList().run()}
                  title="Bullet List"
                >
                  <List className="h-4 w-4" />
                </ToolbarButton>
                <ToolbarButton
                  active={editor.isActive('orderedList')}
                  onClick={() => editor.chain().focus().toggleOrderedList().run()}
                  title="Ordered List"
                >
                  <ListOrdered className="h-4 w-4" />
                </ToolbarButton>
                <ToolbarButton
                  active={editor.isActive('link')}
                  onClick={() => {
                    if (editor.isActive('link')) {
                      editor.chain().focus().unsetLink().run();
                    } else {
                      const url = window.prompt('Enter URL:');
                      if (url) {
                        editor.chain().focus().setLink({ href: url }).run();
                      }
                    }
                  }}
                  title="Link"
                >
                  <LinkIcon className="h-4 w-4" />
                </ToolbarButton>
                <div className="bg-border mx-1 w-px" />
                <ToolbarButton
                  onClick={() => editor.chain().focus().undo().run()}
                  disabled={!editor.can().undo()}
                  title="Undo"
                >
                  <Undo className="h-4 w-4" />
                </ToolbarButton>
                <ToolbarButton
                  onClick={() => editor.chain().focus().redo().run()}
                  disabled={!editor.can().redo()}
                  title="Redo"
                >
                  <Redo className="h-4 w-4" />
                </ToolbarButton>
              </>
            )}
          </div>

          {/* Tab switcher */}
          <div className="flex gap-1">
            <TabButton
              active={activeTab === 'edit'}
              onClick={() => switchTab('edit')}
              title="Editor"
            >
              <Pencil className="h-3.5 w-3.5" />
            </TabButton>
            <TabButton
              active={activeTab === 'preview'}
              onClick={() => switchTab('preview')}
              title="Preview"
            >
              <Eye className="h-3.5 w-3.5" />
            </TabButton>
            <TabButton active={activeTab === 'html'} onClick={() => switchTab('html')} title="HTML">
              <Code2 className="h-3.5 w-3.5" />
            </TabButton>
          </div>
        </div>
      )}

      {/* Content area */}
      {activeTab === 'edit' && (
        <div className="relative">
          <EditorContent editor={editor} />
          {placeholder && !editor.getText() && (
            <div className="text-muted-foreground pointer-events-none absolute top-4 left-4 text-sm">
              {placeholder}
            </div>
          )}
        </div>
      )}

      {activeTab === 'preview' && (
        <div
          className="prose prose-sm dark:prose-invert prose-p:text-foreground prose-li:text-foreground prose-headings:text-foreground max-w-none p-4 break-all"
          style={{ minHeight }}
          dangerouslySetInnerHTML={{ __html: editor.getHTML() }}
        />
      )}

      {activeTab === 'html' && (
        <textarea
          value={htmlSource}
          onChange={(e) => setHtmlSource(e.target.value)}
          className="bg-background text-foreground w-full resize-none p-4 font-mono text-sm focus:outline-none"
          style={{ minHeight }}
          spellCheck={false}
        />
      )}
    </div>
  );
}

function ToolbarButton({
  active,
  disabled,
  onClick,
  title,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        'rounded p-1.5 transition-colors',
        active
          ? 'bg-accent text-accent-foreground'
          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
        disabled && 'cursor-not-allowed opacity-50',
      )}
    >
      {children}
    </button>
  );
}

function TabButton({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        'rounded px-2 py-1 text-xs transition-colors',
        active
          ? 'bg-primary text-primary-foreground'
          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
      )}
    >
      {children}
    </button>
  );
}
