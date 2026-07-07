# Phase 7.4 — FILE Lesson Type

> Thêm lesson type mới `FILE` cho phép instructor upload PDF/DOCX/TXT làm nội dung bài học.
> Student xem file trực tiếp trong trình duyệt (inline viewer) + có thể tải về.
> File được extract text để tích hợp vào RAG pipeline (AI Tutor).

---

## 1. Tổng quan kiến trúc

```
Instructor upload file (PDF/DOCX/TXT)
  → Cloudinary (raw resource type) → secure_url
  → PATCH /instructor/courses/:courseId/chapters/:chapterId/lessons/:lessonId
      { type: 'FILE', fileUrl, fileMimeType, title, estimatedDuration }
  → LessonsService.update() → prisma.lesson.update()

Khi indexCourseContent() chạy (cron 5AM hoặc admin approve):
  → Gặp lesson type=FILE → download file từ fileUrl
  → TextExtractionService.extract(url, mimeType) → plain text
  → Lưu vào lesson.fileExtractedText (cache, tránh re-download)
  → insertChunks(courseId, lessonId, text) → RAG embedding

Student mở lesson FILE:
  → FileViewer component
  → PDF → <iframe src={url}>
  → DOCX/XLSX/PPTX → Google Docs Viewer iframe
  → Images → <img> lightbox
  → TXT → fetch + <pre>
  → Khác → Download button only
  → Nút "Tải xuống" + "Đánh dấu hoàn thành"
```

---

## 2. Schema Changes — Prisma

**File:** `apps/api/src/prisma/schema.prisma`

### 2a. Thêm FILE vào LessonType enum

```prisma
// BEFORE
enum LessonType {
  VIDEO
  TEXT
  QUIZ
}

// AFTER
enum LessonType {
  VIDEO
  TEXT
  QUIZ
  FILE
}
```

### 2b. Thêm 3 fields vào Lesson model

```prisma
model Lesson {
  id                String     @id @default(cuid())
  title             String
  type              LessonType @default(VIDEO)
  order             Int        @default(0)
  textContent       String?    @map("text_content")
  videoUrl          String?    @map("video_url")
  fileUrl           String?    @map("file_url")           // ← NEW: Cloudinary raw URL
  fileMimeType      String?    @map("file_mime_type")     // ← NEW: e.g. "application/pdf"
  fileExtractedText String?    @map("file_extracted_text") // ← NEW: extracted text for RAG (cached)
  estimatedDuration Int?       @map("estimated_duration")
  chapterId         String     @map("chapter_id")
  // ...relations unchanged
}
```

### 2c. Migration

```bash
cd apps/api
npx prisma migrate dev --name add_file_lesson_type
```

Prisma tự generate SQL:
```sql
ALTER TYPE "LessonType" ADD VALUE 'FILE';
ALTER TABLE "lessons"
  ADD COLUMN "file_url" TEXT,
  ADD COLUMN "file_mime_type" TEXT,
  ADD COLUMN "file_extracted_text" TEXT;
```

---

## 3. Backend — npm dependencies

```bash
cd apps/api
npm install pdf-parse mammoth
npm install -D @types/pdf-parse @types/mammoth
```

- `pdf-parse`: extract text từ PDF buffer
- `mammoth`: convert DOCX → plain text

---

## 4. Backend — TextExtractionService

**File mới:** `apps/api/src/modules/ai-tutor/text-extraction/text-extraction.service.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';

const SUPPORTED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
  'text/plain',
  'text/markdown',
];

@Injectable()
export class TextExtractionService {
  private readonly logger = new Logger(TextExtractionService.name);

  canExtract(mimeType: string): boolean {
    return SUPPORTED_MIME_TYPES.includes(mimeType);
  }

  async extract(url: string, mimeType: string): Promise<string> {
    if (!this.canExtract(mimeType)) return '';

    try {
      // Download file from Cloudinary URL into memory buffer
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to fetch file: ${response.status}`);
      const buffer = Buffer.from(await response.arrayBuffer());
      // Buffer is held in RAM only during extraction, then GC'd

      if (mimeType === 'application/pdf') {
        return await this.extractPdf(buffer);
      }
      if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        return await this.extractDocx(buffer);
      }
      if (mimeType === 'text/plain' || mimeType === 'text/markdown') {
        return buffer.toString('utf-8');
      }
      return '';
    } catch (error) {
      this.logger.warn(`Text extraction failed for ${url}: ${error}`);
      return ''; // graceful degradation — lesson still works, just not in RAG
    }
  }

  private async extractPdf(buffer: Buffer): Promise<string> {
    const pdfParse = (await import('pdf-parse')).default;
    const data = await pdfParse(buffer);
    return data.text.trim();
  }

  private async extractDocx(buffer: Buffer): Promise<string> {
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    return result.value.trim();
  }
}
```

---

## 5. Backend — AiTutorModule: register TextExtractionService

**File:** `apps/api/src/modules/ai-tutor/ai-tutor.module.ts`

```typescript
// Thêm vào providers và exports:
import { TextExtractionService } from './text-extraction/text-extraction.service';

@Module({
  providers: [AiTutorService, EmbeddingsService, TextExtractionService],
  exports: [AiTutorService, EmbeddingsService, TextExtractionService],
  // ...
})
export class AiTutorModule {}
```

---

## 6. Backend — EmbeddingsService: xử lý FILE lesson

**File:** `apps/api/src/modules/ai-tutor/embeddings/embeddings.service.ts`

### 6a. Inject TextExtractionService

```typescript
constructor(
  @Inject(PrismaService) private readonly prisma: PrismaService,
  @Inject(TextExtractionService) private readonly textExtraction: TextExtractionService,
) {}
```

### 6b. Cập nhật prisma query trong indexCourseContent() — thêm fileUrl, fileMimeType, fileExtractedText vào lesson select

```typescript
lessons: {
  orderBy: { order: 'asc' },
  select: {
    id: true,
    title: true,
    type: true,
    textContent: true,
    fileUrl: true,        // ← ADD
    fileMimeType: true,   // ← ADD
    fileExtractedText: true, // ← ADD
    quiz: { ... },
  },
},
```

### 6c. Thêm branch FILE trong vòng lặp lesson

```typescript
// Sau branch VIDEO, thêm:
} else if (lesson.type === 'FILE' && lesson.fileUrl) {
  // Get cached extracted text, or extract + cache now
  let extractedText = lesson.fileExtractedText;

  if (!extractedText && lesson.fileMimeType && this.textExtraction.canExtract(lesson.fileMimeType)) {
    this.logger.log(`Extracting text from FILE lesson ${lesson.id}...`);
    extractedText = await this.textExtraction.extract(lesson.fileUrl, lesson.fileMimeType);

    if (extractedText) {
      // Cache for future index runs — avoid re-downloading
      await this.prisma.lesson.update({
        where: { id: lesson.id },
        data: { fileExtractedText: extractedText },
      });
    }
  }

  if (extractedText) {
    const text = `${chapterHeader}\n[File Lesson] ${lesson.title}\n${extractedText}`;
    chunksInserted += await this.insertChunks(courseId, lesson.id, text);
  } else {
    // File type not supported for extraction — index title only
    const text = `${chapterHeader}\n[File Lesson] ${lesson.title}`;
    if (text.length >= 30) chunksInserted += await this.insertChunks(courseId, lesson.id, text);
  }
}
```

**Lưu ý:** Khi file bị thay thế (instructor upload file mới), `fileExtractedText` phải được reset về `null` để trigger re-extract. Làm điều này trong LessonsService.update().

---

## 7. Backend — DTOs: thêm fileUrl, fileMimeType

**File:** `apps/api/src/modules/courses/dto/create-lesson.dto.ts`

```typescript
// Thêm vào CreateLessonDto:
@ApiPropertyOptional({ description: 'Cloudinary raw URL (for FILE type)' })
@IsOptional()
@IsString()
fileUrl?: string;

@ApiPropertyOptional({ description: 'MIME type of the file (for FILE type)' })
@IsOptional()
@IsString()
fileMimeType?: string;

// Thêm tương tự vào UpdateLessonDto
```

---

## 8. Backend — LessonsService: xử lý FILE type

**File:** `apps/api/src/modules/courses/lessons/lessons.service.ts`

### 8a. create() — thêm fileUrl, fileMimeType vào prisma.lesson.create()

```typescript
const lesson = await this.prisma.lesson.create({
  data: {
    title: dto.title,
    type: dto.type,
    order: dto.order,
    textContent: dto.textContent,
    videoUrl: dto.videoUrl,
    fileUrl: dto.fileUrl,           // ← ADD
    fileMimeType: dto.fileMimeType, // ← ADD
    estimatedDuration: dto.estimatedDuration,
    chapterId,
  },
});
```

### 8b. update() — reset fileExtractedText khi fileUrl thay đổi

```typescript
const updated = await this.prisma.lesson.update({
  where: { id: lessonId },
  data: {
    ...dto,
    // Reset cached extracted text when file URL changes → force re-extraction on next index
    ...(dto.fileUrl !== undefined ? { fileExtractedText: null } : {}),
  },
});
```

---

## 9. Backend — Learning endpoint: trả về fileUrl, fileMimeType

**Tìm endpoint trả về lesson data cho student** (learning module, thường là `GET /learning/courses/:courseId/lessons/:lessonId`).

Đảm bảo Prisma select bao gồm:
```typescript
select: {
  // ...existing fields
  fileUrl: true,
  fileMimeType: true,
  // KHÔNG trả về fileExtractedText — không cần thiết cho student
}
```

---

## 10. Shared Types — packages/shared-types

**File:** `packages/shared-types/src/index.ts`

### 10a. LessonType enum

```typescript
export enum LessonType {
  VIDEO = 'VIDEO',
  TEXT = 'TEXT',
  QUIZ = 'QUIZ',
  FILE = 'FILE', // ← ADD
}
```

### 10b. Lesson interface

```typescript
export interface Lesson {
  id: string;
  title: string;
  type: LessonType;
  order: number;
  estimatedDuration: number | null;
  fileUrl?: string | null;      // ← ADD
  fileMimeType?: string | null; // ← ADD
}
```

---

## 11. Shared UI — FileViewer component

**File mới:** `packages/shared-ui/src/components/FileViewer.tsx`

Component nhận translated labels qua props (không dùng useTranslations bên trong — tránh coupling với namespace cụ thể).

```typescript
'use client';

import { useState } from 'react';
import { Download, ExternalLink, FileText, X } from 'lucide-react';
import { Button } from './button';
import { cn } from '../lib/utils';

export type FileViewerMode = 'inline' | 'modal';

interface FileViewerProps {
  url: string;
  mimeType: string;
  fileName: string;
  // Translated labels passed from parent
  labels: {
    download: string;       // "Tải xuống"
    openInNewTab: string;   // "Mở tab mới"
    unsupportedFile: string; // "Không thể xem trực tiếp"
    loadingViewer: string;  // "Đang tải..."
    close: string;          // "Đóng" (for modal mode)
  };
  mode?: FileViewerMode; // 'inline' (default) | 'modal'
  onClose?: () => void;  // required if mode='modal'
  className?: string;
}

// Determine how to render based on MIME type
function getViewerType(mimeType: string): 'pdf' | 'image' | 'google-docs' | 'text' | 'download' {
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType.startsWith('image/')) return 'image';
  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || // docx
    mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||       // xlsx
    mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' || // pptx
    mimeType === 'application/msword' ||      // doc
    mimeType === 'application/vnd.ms-excel'   // xls
  ) return 'google-docs';
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
  const viewerType = getViewerType(mimeType);

  // Fetch TXT content on first render
  if (viewerType === 'text' && textContent === null && !textLoading) {
    setTextLoading(true);
    fetch(url)
      .then((r) => r.text())
      .then((t) => { setTextContent(t); setTextLoading(false); })
      .catch(() => { setTextContent(''); setTextLoading(false); });
  }

  // Google Docs Viewer URL (requires publicly accessible URL — Cloudinary URLs are public)
  const googleDocsUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`;

  const viewerContent = (
    <div className={cn('flex flex-col', mode === 'inline' ? 'h-full' : 'h-[80vh]', className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b px-4 py-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate text-sm font-medium">{fileName}</span>
        </div>
        <div className="flex items-center gap-2 ml-2 shrink-0">
          <Button variant="outline" size="sm" asChild>
            <a href={url} download={fileName} target="_blank" rel="noopener noreferrer">
              <Download className="mr-1 h-3 w-3" />
              {labels.download}
            </a>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <a href={url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3 w-3" />
            </a>
          </Button>
          {mode === 'modal' && onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Viewer area */}
      <div className="flex-1 overflow-hidden bg-muted/30">
        {viewerType === 'pdf' && (
          <iframe
            src={url}
            className="h-full w-full border-0"
            title={fileName}
          />
        )}

        {viewerType === 'google-docs' && (
          <iframe
            src={googleDocsUrl}
            className="h-full w-full border-0"
            title={fileName}
          />
        )}

        {viewerType === 'image' && (
          <div className="flex h-full items-center justify-center p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={fileName}
              className="max-h-full max-w-full object-contain"
            />
          </div>
        )}

        {viewerType === 'text' && (
          <div className="h-full overflow-auto p-4">
            {textLoading ? (
              <p className="text-muted-foreground text-sm">{labels.loadingViewer}</p>
            ) : (
              <pre className="whitespace-pre-wrap font-mono text-sm">{textContent}</pre>
            )}
          </div>
        )}

        {viewerType === 'download' && (
          <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
            <FileText className="h-16 w-16 text-muted-foreground/50" />
            <p className="text-muted-foreground text-sm">{labels.unsupportedFile}</p>
            <Button asChild>
              <a href={url} download={fileName}>
                <Download className="mr-2 h-4 w-4" />
                {labels.download}
              </a>
            </Button>
          </div>
        )}
      </div>
    </div>
  );

  // Modal mode: renders with backdrop overlay
  if (mode === 'modal') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
        <div className="bg-background border-border h-[85vh] w-full max-w-5xl overflow-hidden rounded-xl border shadow-2xl">
          {viewerContent}
        </div>
      </div>
    );
  }

  // Inline mode
  return viewerContent;
}
```

**Export từ shared-ui:**
```typescript
// packages/shared-ui/src/index.ts — thêm:
export { FileViewer } from './components/FileViewer';
export type { FileViewerMode } from './components/FileViewer';
```

---

## 12. Management Portal — FileUpload component

**File mới:** `apps/management-portal/src/components/courses/file-upload.tsx`

Pattern giống VideoUpload nhưng cho raw files.

```typescript
'use client';

import { useState, useRef, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { File, X } from 'lucide-react';
import { cn, Button, Progress } from '@shared/ui';
import { uploadToCloudinary } from '@/lib/cloudinary';

const ACCEPTED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'text/plain',
  'text/markdown',
];
const ACCEPTED_EXTENSIONS = '.pdf,.docx,.doc,.txt,.md';
const MAX_SIZE_MB = 25;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

export interface FileUploadResult {
  url: string;
  mimeType: string;
  fileName: string;
  size: number; // bytes
}

interface FileUploadProps {
  value?: FileUploadResult;
  onChange: (result: FileUploadResult) => void;
  onRemove?: () => void;
}

// Human-readable file size
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileUpload({ value, onChange, onRemove }: FileUploadProps) {
  const t = useTranslations('courseWizard');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      if (!ACCEPTED_MIME_TYPES.includes(file.type) && file.type !== '') {
        setError(t('invalidFileType'));
        return;
      }
      if (file.size > MAX_SIZE_BYTES) {
        setError(t('fileTooLarge', { max: MAX_SIZE_MB }));
        return;
      }

      setError(null);
      setUploading(true);
      setProgress(0);

      try {
        const result = await uploadToCloudinary(file, 'raw', setProgress);
        onChange({
          url: result.secure_url,
          mimeType: file.type,
          fileName: file.name,
          size: file.size,
        });
      } catch {
        setError(t('uploadFailed'));
      } finally {
        setUploading(false);
      }
    },
    [onChange, t],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  // Uploaded state — show file info
  if (value) {
    return (
      <div className="border-border w-full max-w-md rounded-lg border p-4">
        <div className="flex items-start gap-3">
          <div className="bg-primary/10 rounded-lg p-2">
            <File className="text-primary h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{value.fileName}</p>
            <p className="text-muted-foreground text-xs">{formatBytes(value.size)}</p>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
              {t('changeFile')}
            </Button>
            {onRemove && (
              <Button type="button" variant="outline" size="sm" onClick={onRemove}>
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_EXTENSIONS}
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />
      </div>
    );
  }

  // Upload state
  return (
    <div>
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => !uploading && inputRef.current?.click()}
        className={cn(
          'border-border hover:border-primary flex w-full max-w-md cursor-pointer flex-col items-center',
          'justify-center rounded-lg border-2 border-dashed py-8 transition-colors',
          uploading && 'pointer-events-none opacity-70',
        )}
      >
        {uploading ? (
          <div className="w-3/4 space-y-2 text-center">
            <p className="text-muted-foreground text-sm">{t('uploadingFile')}...</p>
            <Progress value={progress} className="h-2" />
            <p className="text-muted-foreground text-xs">{progress}%</p>
          </div>
        ) : (
          <>
            <File className="text-muted-foreground mb-2 h-8 w-8" />
            <p className="text-muted-foreground text-sm">{t('dropOrClickFile')}</p>
            <p className="text-muted-foreground text-xs mt-1">PDF, DOCX, TXT (tối đa {MAX_SIZE_MB}MB)</p>
          </>
        )}
      </div>
      {error && <p className="text-destructive mt-1 text-sm">{error}</p>}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_EXTENSIONS}
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
      />
    </div>
  );
}
```

---

## 13. Management Portal — LessonDialog: thêm FILE tab

**File:** `apps/management-portal/src/components/courses/wizard/lesson-dialog.tsx`

### 13a. Import thêm

```typescript
import { Video, FileText, HelpCircle, File, X } from 'lucide-react'; // Add File icon
import { FileViewer } from '@shared/ui'; // shared viewer
import { FileUpload, type FileUploadResult } from '../file-upload';

type LessonType = 'VIDEO' | 'TEXT' | 'QUIZ' | 'FILE'; // ← ADD FILE
```

### 13b. TYPE_TABS — thêm FILE

```typescript
const TYPE_TABS: Array<{ type: LessonType; icon: typeof Video; label: string }> = [
  { type: 'VIDEO', icon: Video, label: 'video' },
  { type: 'TEXT', icon: FileText, label: 'text' },
  { type: 'FILE', icon: File, label: 'file' },   // ← ADD
  { type: 'QUIZ', icon: HelpCircle, label: 'quiz' },
];
```

### 13c. State — thêm fileData state

```typescript
const [fileData, setFileData] = useState<FileUploadResult | undefined>();
const [previewOpen, setPreviewOpen] = useState(false);

// Trong useEffect khi open:
setFileData(lesson?.fileUrl ? {
  url: lesson.fileUrl,
  mimeType: lesson.fileMimeType ?? '',
  fileName: lesson.title, // fallback to title if fileName not stored
  size: 0,
} : undefined);
```

### 13d. handleSave — thêm FILE data

```typescript
const savedLesson: LocalLesson = {
  // ...existing
  fileUrl: type === 'FILE' ? fileData?.url : undefined,
  fileMimeType: type === 'FILE' ? fileData?.mimeType : undefined,
  // Reset extracted text khi file thay đổi (handled by backend)
};
```

### 13e. JSX — thêm FILE branch trong type-specific content

```tsx
{type === 'FILE' && (
  <div className="space-y-3">
    <Label>{t('uploadFile')}</Label>
    <FileUpload
      value={fileData}
      onChange={setFileData}
      onRemove={() => setFileData(undefined)}
    />
    {/* Preview button — chỉ hiện khi đã có file */}
    {fileData && (
      <>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setPreviewOpen(true)}
        >
          {t('previewFile')}
        </Button>
        {previewOpen && (
          <FileViewer
            url={fileData.url}
            mimeType={fileData.mimeType}
            fileName={fileData.fileName}
            mode="modal"
            onClose={() => setPreviewOpen(false)}
            labels={{
              download: t('download'),
              openInNewTab: t('openInNewTab'),
              unsupportedFile: t('unsupportedFile'),
              loadingViewer: t('loadingViewer'),
              close: t('close'),
            }}
          />
        )}
      </>
    )}
  </div>
)}
```

---

## 14. Management Portal — LocalLesson type

**File:** `apps/management-portal/src/components/courses/wizard/course-wizard.tsx`

```typescript
export interface LocalLesson {
  // ...existing fields
  type: 'VIDEO' | 'TEXT' | 'QUIZ' | 'FILE'; // ← ADD FILE
  fileUrl?: string;      // ← ADD
  fileMimeType?: string; // ← ADD
}
```

---

## 15. Management Portal — StepCurriculum: icons + colors

**File:** `apps/management-portal/src/components/courses/wizard/step-curriculum.tsx`

```typescript
import { Video, FileText, HelpCircle, File } from 'lucide-react'; // ADD File

const LESSON_TYPE_ICONS = {
  VIDEO: Video,
  TEXT: FileText,
  QUIZ: HelpCircle,
  FILE: File,  // ← ADD
} as const;

const LESSON_TYPE_COLORS = {
  VIDEO: 'text-blue-500',
  TEXT: 'text-green-500',
  QUIZ: 'text-amber-500',
  FILE: 'text-violet-500', // ← ADD
} as const;
```

### Batch save: thêm fileUrl, fileMimeType vào createLesson / updateLesson call

Tìm chỗ gọi `createLesson.mutateAsync()` và `updateLesson.mutateAsync()` trong `saveCurriculum()` — thêm:
```typescript
fileUrl: lesson.fileUrl,
fileMimeType: lesson.fileMimeType,
```

---

## 16. Management Portal — i18n

**Files:** `apps/management-portal/messages/vi.json` + `en.json`

Thêm vào `courseWizard` namespace:
```json
// vi.json
"file": "Tài liệu",
"uploadFile": "Tải lên tài liệu",
"dropOrClickFile": "Kéo thả hoặc click để chọn file",
"uploadingFile": "Đang tải file lên",
"changeFile": "Đổi file",
"invalidFileType": "Chỉ chấp nhận PDF, DOCX, TXT",
"fileTooLarge": "File quá lớn (tối đa {max}MB)",
"previewFile": "Xem trước",
"download": "Tải xuống",
"openInNewTab": "Mở tab mới",
"unsupportedFile": "Không thể xem trực tiếp, vui lòng tải về",
"loadingViewer": "Đang tải...",
"close": "Đóng"

// en.json
"file": "Document",
"uploadFile": "Upload document",
"dropOrClickFile": "Drag & drop or click to select file",
"uploadingFile": "Uploading file",
"changeFile": "Change file",
"invalidFileType": "Only PDF, DOCX, TXT accepted",
"fileTooLarge": "File too large (max {max}MB)",
"previewFile": "Preview",
"download": "Download",
"openInNewTab": "Open in new tab",
"unsupportedFile": "Cannot preview this file type, please download",
"loadingViewer": "Loading...",
"close": "Close"
```

---

## 17. Student Portal — LessonData type + FILE branch

**File:** `apps/student-portal/src/app/[locale]/(learning)/courses/[slug]/lessons/[lessonId]/page.tsx`

### 17a. LessonData interface — thêm fields

```typescript
interface LessonData {
  // ...existing fields
  fileUrl: string | null;      // ← ADD
  fileMimeType: string | null; // ← ADD
}
```

### 17b. FileViewer branch trong render

```tsx
// Sau branch QUIZ:
} else if (lessonContent.type === 'FILE' && lessonContent.fileUrl) (
  <FileViewer
    url={lessonContent.fileUrl}
    mimeType={lessonContent.fileMimeType ?? 'application/octet-stream'}
    fileName={lessonContent.title}
    mode="inline"
    labels={{
      download: t('download'),
      openInNewTab: t('openInNewTab'),
      unsupportedFile: t('unsupportedFile'),
      loadingViewer: t('loadingViewer'),
      close: t('close'),
    }}
    className="h-full"
  />
)
```

### 17c. "Đánh dấu hoàn thành" cho FILE lesson

FILE lesson cần có mark complete button như TEXT lesson. Tạo `FileViewer` wrapper trong student portal để kết hợp viewer + complete button:

**File mới:** `apps/student-portal/src/components/learning/file-lesson-viewer.tsx`

```tsx
'use client';

import { useTranslations } from 'next-intl';
import { CheckCircle2 } from 'lucide-react';
import { Button, Badge, FileViewer } from '@shared/ui';
import { useCompleteLesson } from '@shared/hooks';

interface FileLessonViewerProps {
  lessonId: string;
  fileUrl: string;
  fileMimeType: string;
  fileName: string;
  isCompleted: boolean;
}

export function FileLessonViewer({
  lessonId,
  fileUrl,
  fileMimeType,
  fileName,
  isCompleted,
}: FileLessonViewerProps) {
  const t = useTranslations('learning');
  const completeMutation = useCompleteLesson();

  return (
    <div className="flex h-full flex-col">
      {/* Completion badge */}
      {isCompleted && (
        <div className="shrink-0 px-4 pt-3">
          <Badge variant="default" className="gap-1">
            <CheckCircle2 className="h-3 w-3" />
            {t('completed')}
          </Badge>
        </div>
      )}

      {/* File viewer — takes remaining space */}
      <div className="min-h-0 flex-1">
        <FileViewer
          url={fileUrl}
          mimeType={fileMimeType}
          fileName={fileName}
          mode="inline"
          labels={{
            download: t('download'),
            openInNewTab: t('openInNewTab'),
            unsupportedFile: t('unsupportedFile'),
            loadingViewer: t('loadingViewer'),
            close: t('close'),
          }}
          className="h-full"
        />
      </div>

      {/* Mark Complete */}
      {!isCompleted && (
        <div className="shrink-0 border-t px-4 py-3 flex justify-end">
          <Button
            onClick={() => completeMutation.mutate(lessonId)}
            disabled={completeMutation.isPending}
            className="gap-2"
          >
            <CheckCircle2 className="h-4 w-4" />
            {completeMutation.isPending ? t('completing') : t('markComplete')}
          </Button>
        </div>
      )}
    </div>
  );
}
```

Trong `page.tsx`, thay branch FILE thành:
```tsx
} else if (lessonContent.type === 'FILE' && lessonContent.fileUrl) {
  return (
    <FileLessonViewer
      lessonId={lessonId}
      fileUrl={lessonContent.fileUrl}
      fileMimeType={lessonContent.fileMimeType ?? 'application/octet-stream'}
      fileName={lessonContent.title}
      isCompleted={lessonContent.isCompleted}
    />
  );
}
```

---

## 18. Student Portal — CurriculumSidebar: FILE icon

**File:** `apps/student-portal/src/components/learning/curriculum-sidebar.tsx`

```typescript
import { Play, FileText, FileQuestion, BookOpen, File } from 'lucide-react'; // ADD File

const LESSON_ICONS: Record<string, typeof Play> = {
  VIDEO: Play,
  TEXT: FileText,
  QUIZ: FileQuestion,
  FILE: File,  // ← ADD
};
```

---

## 19. Student Portal — i18n

**Files:** `apps/student-portal/messages/vi.json` + `en.json`

Thêm vào `learning` namespace:
```json
// vi.json
"download": "Tải xuống",
"openInNewTab": "Mở tab mới",
"unsupportedFile": "Không thể xem trực tiếp, vui lòng tải về",
"loadingViewer": "Đang tải..."

// en.json
"download": "Download",
"openInNewTab": "Open in new tab",
"unsupportedFile": "Cannot preview this file, please download",
"loadingViewer": "Loading..."
```

---

## 20. Shared API Client / Hooks

**Check file:** `packages/shared-hooks/src/queries/use-lesson.ts` (hoặc tương tự)

Đảm bảo lesson data query trả về `fileUrl` và `fileMimeType` — thường là tự động vì API trả về toàn bộ object.

---

## 21. Thứ tự implement (để tránh lỗi build)

```
1. Schema migration (prisma migrate dev)
2. Backend: TextExtractionService (no deps)
3. Backend: AiTutorModule register + EmbeddingsService update
4. Backend: DTOs + LessonsService update
5. Backend: Learning endpoint include fileUrl, fileMimeType
6. shared-types: LessonType + Lesson interface (unblocks FE)
7. shared-ui: FileViewer component + export
8. Management portal: FileUpload + LessonDialog + LocalLesson + StepCurriculum + i18n
9. Student portal: FileLessonViewer + CurriculumSidebar + i18n + page.tsx
```

---

## 22. Checklist

- [ ] `prisma migrate dev --name add_file_lesson_type`
- [ ] `npm install pdf-parse mammoth` in apps/api
- [ ] `npm install @types/pdf-parse @types/mammoth -D` in apps/api
- [ ] TextExtractionService created + registered in AiTutorModule
- [ ] EmbeddingsService handles FILE type (extract → cache → chunk)
- [ ] CreateLessonDto / UpdateLessonDto có fileUrl, fileMimeType
- [ ] LessonsService.create() / update() handle FILE type + reset fileExtractedText
- [ ] Learning endpoint includes fileUrl, fileMimeType in response
- [ ] shared-types: LessonType.FILE + Lesson.fileUrl/fileMimeType
- [ ] shared-ui: FileViewer exported
- [ ] Management: FileUpload component
- [ ] Management: LessonDialog — FILE tab + preview
- [ ] Management: LocalLesson type includes FILE
- [ ] Management: StepCurriculum icons + batch save includes fileUrl/fileMimeType
- [ ] Management: i18n keys
- [ ] Student: FileLessonViewer (viewer + mark complete)
- [ ] Student: CurriculumSidebar — FILE icon
- [ ] Student: i18n keys
- [ ] Student: page.tsx — LessonData type + FILE branch
