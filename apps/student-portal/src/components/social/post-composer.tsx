'use client';

import { useState, useRef, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { ImageIcon, Code2, X, Loader2, Send } from 'lucide-react';
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
  Button,
  Card,
  CardContent,
  Select,
  Textarea,
} from '@shared/ui';
import { useAuthStore, useCreatePost } from '@shared/hooks';
import { uploadToCloudinary } from '@/lib/cloudinary';
import { toast } from 'sonner';

const CODE_LANGUAGES = [
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'python', label: 'Python' },
  { value: 'java', label: 'Java' },
  { value: 'csharp', label: 'C#' },
  { value: 'cpp', label: 'C++' },
  { value: 'go', label: 'Go' },
  { value: 'rust', label: 'Rust' },
  { value: 'html', label: 'HTML' },
  { value: 'css', label: 'CSS' },
  { value: 'sql', label: 'SQL' },
  { value: 'bash', label: 'Bash' },
  { value: 'other', label: 'Other' },
];

interface UploadedImage {
  url: string;
  publicId: string;
}

export function PostComposer() {
  const t = useTranslations('social');
  const user = useAuthStore((s) => s.user);
  const createPost = useCreatePost();

  const [content, setContent] = useState('');
  const [showCode, setShowCode] = useState(false);
  const [codeLanguage, setCodeLanguage] = useState('javascript');
  const [codeContent, setCodeContent] = useState('');
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const initials =
    user?.fullName
      ?.split(' ')
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() ?? '';

  const hasContent = content.trim().length > 0 || (showCode && codeContent.trim().length > 0);

  const handleAutoResize = useCallback((el: HTMLTextAreaElement) => {
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  function handleContentChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setContent(e.target.value);
    handleAutoResize(e.target);
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        const result = await uploadToCloudinary(file, 'image');
        return { url: result.secure_url, publicId: result.public_id };
      });
      const uploaded = await Promise.all(uploadPromises);
      setImages((prev) => [...prev, ...uploaded]);
    } catch {
      // Upload failed silently
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }

  function removeImage(index: number) {
    setImages((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSubmit() {
    if (!hasContent && images.length === 0) return;

    const postType = showCode && codeContent.trim() ? 'CODE' : 'TEXT';

    createPost.mutate(
      {
        content: content.trim(),
        type: postType,
        ...(showCode && codeContent.trim()
          ? { codeSnippet: { language: codeLanguage, code: codeContent.trim() } }
          : {}),
        ...(images.length > 0 ? { imageUrls: images.map((img) => img.url) } : {}),
      },
      {
        onSuccess: () => {
          setContent('');
          setShowCode(false);
          setCodeLanguage('javascript');
          setCodeContent('');
          setImages([]);
          if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
          }
          toast.success(t('postCreated'));
        },
      },
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start gap-3">
          <Avatar className="h-10 w-10 shrink-0">
            {user?.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user?.fullName} />}
            <AvatarFallback className="bg-primary text-primary-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <textarea
              ref={textareaRef}
              value={content}
              onChange={handleContentChange}
              placeholder={t('postPlaceholder')}
              className="text-foreground placeholder:text-muted-foreground w-full resize-none bg-transparent text-sm outline-none"
              rows={2}
            />

            {showCode && (
              <div className="bg-muted mt-2 rounded-lg border p-3">
                <div className="mb-2 max-w-[200px]">
                  <Select
                    options={CODE_LANGUAGES}
                    value={codeLanguage}
                    onChange={(e) => setCodeLanguage(e.target.value)}
                  />
                </div>
                <Textarea
                  value={codeContent}
                  onChange={(e) => setCodeContent(e.target.value)}
                  placeholder="// Code..."
                  className="font-mono text-xs"
                  rows={5}
                />
              </div>
            )}

            {images.length > 0 && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                {images.map((img, idx) => (
                  <div key={img.publicId} className="group relative">
                    <img
                      src={img.url}
                      alt={`Upload ${idx + 1}`}
                      className="h-32 w-full rounded-lg object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(idx)}
                      className="bg-background/80 absolute top-1 right-1 cursor-pointer rounded-full p-1 opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-3 flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleImageUpload}
              />
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground gap-1.5"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
              >
                {isUploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ImageIcon className="h-4 w-4" />
                )}
                {isUploading ? t('uploading') : t('addImage')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className={`gap-1.5 ${showCode ? 'text-primary' : 'text-muted-foreground'}`}
                onClick={() => setShowCode(!showCode)}
              >
                <Code2 className="h-4 w-4" />
                {t('addCode')}
              </Button>
              <div className="ml-auto">
                <Button
                  size="sm"
                  className="gap-1.5"
                  onClick={handleSubmit}
                  disabled={(!hasContent && images.length === 0) || createPost.isPending}
                >
                  {createPost.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                  {t('post')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
