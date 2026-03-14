'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { ArrowLeft, X, Eye, Send } from 'lucide-react';
import {
  Button,
  Input,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Separator,
} from '@shared/ui';
import { mockCourses } from '@/lib/mock-data';
import { useState } from 'react';

export default function AskQuestionPage() {
  const t = useTranslations('askQuestion');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [showPreview, setShowPreview] = useState(false);

  const addTag = () => {
    const tag = tagInput.trim();
    if (tag && !tags.includes(tag) && tags.length < 5) {
      setTags([...tags, tag]);
      setTagInput('');
    }
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/qna">
          <Button variant="ghost" size="sm" className="gap-1">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">{t('title')}</h1>
      </div>

      <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
        {/* Title */}
        <div className="space-y-2">
          <label className="text-sm font-medium">{t('questionTitle')}</label>
          <Input
            placeholder={t('titlePlaceholder')}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        {/* Content */}
        <div className="space-y-2">
          <label className="text-sm font-medium">{t('content')}</label>
          <textarea
            className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring min-h-[200px] w-full resize-y rounded-lg border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
            placeholder={t('contentPlaceholder')}
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
        </div>

        {/* Tags */}
        <div className="space-y-2">
          <label className="text-sm font-medium">{t('tags')}</label>
          <div className="flex gap-2">
            <Input
              placeholder={t('tagsPlaceholder')}
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addTag();
                }
              }}
            />
            <Button type="button" variant="outline" onClick={addTag}>
              {t('addTag')}
            </Button>
          </div>
          {tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="gap-1">
                  {tag}
                  <button onClick={() => removeTag(tag)} className="cursor-pointer">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Course Select */}
        <div className="space-y-2">
          <label className="text-sm font-medium">{t('relatedCourse')}</label>
          <select className="border-input bg-background focus-visible:ring-ring w-full rounded-lg border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none">
            <option value="">{t('selectCourse')}</option>
            {mockCourses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.title}
              </option>
            ))}
          </select>
        </div>

        <Separator />

        {/* Preview Toggle */}
        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setShowPreview(!showPreview)}
          >
            <Eye className="h-4 w-4" />
            {t('preview')}
          </Button>
          <Button type="submit" className="gap-1.5">
            <Send className="h-4 w-4" />
            {t('submit')}
          </Button>
        </div>

        {/* Preview Section */}
        {showPreview && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('previewTitle')}</CardTitle>
            </CardHeader>
            <CardContent>
              <h3 className="mb-2 font-semibold">{title || t('titlePlaceholder')}</h3>
              <p className="text-muted-foreground text-sm whitespace-pre-wrap">
                {content || t('contentPlaceholder')}
              </p>
              {tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </form>
    </div>
  );
}
