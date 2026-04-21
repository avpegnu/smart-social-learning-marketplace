# Phase 7.6 — Admin AI Indexing UI

> Cho phép admin xem trạng thái indexing của từng khóa học và trigger index thủ công
> cho một hoặc nhiều khóa học cùng lúc.

---

## 1. Tổng quan

### Vấn đề hiện tại
- Indexing chỉ chạy tự động: cron 5AM hàng ngày hoặc khi admin approve course
- Instructor vừa thêm FILE lesson → AI Tutor chưa biết nội dung file đó ngay
- Không có UI để admin biết khóa nào đã indexed, bao nhiêu chunks, lần cuối index khi nào

### Giải pháp
Thêm trang `/admin/ai-indexing` với:
- Bảng danh sách tất cả PUBLISHED courses + trạng thái indexing
- Nút "Re-index" per row + nút "Index All Unindexed" + checkbox bulk select
- Loading spinner per row khi đang index
- Badge trạng thái: Indexed / Not indexed / Indexing...

---

## 2. Backend Changes

### 2a. DTO mới — BulkIndexDto

**File:** `apps/api/src/modules/ai-tutor/dto/bulk-index.dto.ts`

```typescript
import { IsArray, IsString, ArrayNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class BulkIndexDto {
  @ApiProperty({ type: [String], description: 'Array of course IDs to index' })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  courseIds!: string[];
}
```

### 2b. EmbeddingsService — thêm 2 methods

**File:** `apps/api/src/modules/ai-tutor/embeddings/embeddings.service.ts`

#### Method 1: `getIndexStatus()`

Trả về danh sách tất cả PUBLISHED courses kèm số chunks và ngày index cuối.

```typescript
async getIndexStatus(): Promise<
  Array<{
    courseId: string;
    title: string;
    chunkCount: number;
    lastIndexed: Date | null;
  }>
> {
  // Fetch all published courses
  const courses = await this.prisma.course.findMany({
    where: { status: 'PUBLISHED', deletedAt: null },
    select: { id: true, title: true },
    orderBy: { title: 'asc' },
  });

  if (courses.length === 0) return [];

  // Aggregate chunk counts + last indexed per course via raw SQL
  // (CourseChunk embedding field is managed via raw SQL, so use raw for consistency)
  const stats = await this.prisma.$queryRaw<
    Array<{ course_id: string; chunk_count: bigint; last_indexed: Date | null }>
  >`
    SELECT
      course_id,
      COUNT(*)::bigint AS chunk_count,
      MAX(created_at)  AS last_indexed
    FROM course_chunks
    WHERE course_id = ANY(${courses.map((c) => c.id)}::text[])
    GROUP BY course_id
  `;

  // Build a lookup map from the raw results
  const statsMap = new Map(
    stats.map((s) => [
      s.course_id,
      { chunkCount: Number(s.chunk_count), lastIndexed: s.last_indexed },
    ]),
  );

  return courses.map((c) => ({
    courseId: c.id,
    title: c.title,
    chunkCount: statsMap.get(c.id)?.chunkCount ?? 0,
    lastIndexed: statsMap.get(c.id)?.lastIndexed ?? null,
  }));
}
```

#### Method 2: `bulkIndexCourses(courseIds: string[])`

Index tuần tự nhiều courses, trả về kết quả tổng hợp.

```typescript
async bulkIndexCourses(courseIds: string[]): Promise<{
  indexed: number;
  failed: number;
  errors: Array<{ courseId: string; error: string }>;
}> {
  let indexed = 0;
  let failed = 0;
  const errors: Array<{ courseId: string; error: string }> = [];

  for (const courseId of courseIds) {
    try {
      await this.indexCourseContent(courseId);
      indexed++;
    } catch (error) {
      failed++;
      errors.push({ courseId, error: String(error) });
      this.logger.warn(`Bulk index failed for course ${courseId}: ${String(error)}`);
    }
  }

  return { indexed, failed, errors };
}
```

### 2c. AiTutorController — thêm 2 endpoints

**File:** `apps/api/src/modules/ai-tutor/ai-tutor.controller.ts`

Import thêm:
```typescript
import { BulkIndexDto } from './dto/bulk-index.dto';
```

#### Endpoint 1: GET index status (admin only)

```typescript
@Get('courses/index-status')
@UseGuards(RolesGuard)
@Roles(Role.ADMIN)
@ApiOperation({ summary: 'Get AI indexing status for all published courses (admin)' })
async getIndexStatus() {
  return this.embeddingsService.getIndexStatus();
}
```

#### Endpoint 2: POST bulk index (admin only)

```typescript
@Post('index/bulk')
@UseGuards(RolesGuard)
@Roles(Role.ADMIN)
@ApiOperation({ summary: 'Bulk index multiple courses for AI Tutor (admin)' })
async bulkIndexCourses(@Body() dto: BulkIndexDto) {
  return this.embeddingsService.bulkIndexCourses(dto.courseIds);
}
```

**Lưu ý thứ tự route quan trọng:**
- `GET courses/index-status` phải đặt TRƯỚC `POST index/:courseId` trong file
- NestJS match routes theo thứ tự khai báo; `index-status` phải không bị match bởi `:courseId` pattern
- Hiện tại OK vì `GET` vs `POST` khác method — nhưng nên đặt `GET courses/index-status` gần các GET endpoints

---

## 3. Shared Packages Changes

### 3a. aiTutorService — thêm 2 methods

**File:** `packages/shared-hooks/src/services/ai-tutor.service.ts`

```typescript
export interface IndexStatusItem {
  courseId: string;
  title: string;
  chunkCount: number;
  lastIndexed: string | null; // ISO date string
}

export interface BulkIndexResult {
  indexed: number;
  failed: number;
  errors: Array<{ courseId: string; error: string }>;
}

// Thêm vào aiTutorService object:
getIndexStatus: (): Promise<{ data: IndexStatusItem[] }> =>
  apiClient.get('/ai/tutor/courses/index-status'),

indexCourse: (courseId: string): Promise<{ message: string }> =>
  apiClient.post(`/ai/tutor/index/${courseId}`, {}),

bulkIndex: (courseIds: string[]): Promise<BulkIndexResult> =>
  apiClient.post('/ai/tutor/index/bulk', { courseIds }),
```

### 3b. use-ai-tutor.ts — thêm 3 hooks

**File:** `packages/shared-hooks/src/queries/use-ai-tutor.ts`

```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { aiTutorService } from '../services/ai-tutor.service';
import { useApiError } from '../use-api-error';

// Existing hooks (unchanged): useAiQuota, useAiSessions, useSessionMessages

// ── NEW ──

export function useIndexStatus() {
  return useQuery({
    queryKey: ['ai-tutor', 'index-status'],
    queryFn: () => aiTutorService.getIndexStatus(),
    // Refetch every 30s so status stays fresh after indexing
    refetchInterval: 30_000,
  });
}

export function useIndexCourse() {
  const queryClient = useQueryClient();
  const getErrorMessage = useApiError();
  return useMutation({
    mutationFn: (courseId: string) => aiTutorService.indexCourse(courseId),
    onSuccess: () => {
      // Invalidate index status so table refreshes
      void queryClient.invalidateQueries({ queryKey: ['ai-tutor', 'index-status'] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useBulkIndexCourses() {
  const queryClient = useQueryClient();
  const getErrorMessage = useApiError();
  return useMutation({
    mutationFn: (courseIds: string[]) => aiTutorService.bulkIndex(courseIds),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['ai-tutor', 'index-status'] });
      // onSuccess callback in page component will show toast with result details
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}
```

### 3c. shared-hooks index.ts — export mới

**File:** `packages/shared-hooks/src/index.ts`

```typescript
// Thêm vào exports:
export { useIndexStatus, useIndexCourse, useBulkIndexCourses } from './queries/use-ai-tutor';
export type { IndexStatusItem, BulkIndexResult } from './services/ai-tutor.service';
```

---

## 4. Management Portal — Admin Page

### 4a. Trang chính

**File mới:** `apps/management-portal/src/app/[locale]/admin/ai-indexing/page.tsx`

```typescript
'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import {
  RefreshCw,
  Brain,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import {
  Button,
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
} from '@shared/ui';
import {
  useIndexStatus,
  useIndexCourse,
  useBulkIndexCourses,
} from '@shared/hooks';
import type { IndexStatusItem } from '@shared/hooks';
import { toast } from 'sonner';

export default function AiIndexingPage() {
  const t = useTranslations('aiIndexing');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // Track which courseIds are currently being indexed (for per-row loading)
  const [indexingIds, setIndexingIds] = useState<Set<string>>(new Set());

  const { data, isLoading, refetch } = useIndexStatus();
  const indexCourseMutation = useIndexCourse();
  const bulkIndexMutation = useBulkIndexCourses();

  const items: IndexStatusItem[] = (data?.data as IndexStatusItem[]) ?? [];

  const unindexedCount = useMemo(
    () => items.filter((i) => i.chunkCount === 0).length,
    [items],
  );

  // ── Handlers ──

  const handleSelectAll = (checked: boolean) => {
    setSelectedIds(checked ? new Set(items.map((i) => i.courseId)) : new Set());
  };

  const handleSelectOne = (courseId: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      checked ? next.add(courseId) : next.delete(courseId);
      return next;
    });
  };

  const handleIndexOne = async (courseId: string) => {
    setIndexingIds((prev) => new Set(prev).add(courseId));
    try {
      await indexCourseMutation.mutateAsync(courseId);
      toast.success(t('indexSuccess'));
    } finally {
      setIndexingIds((prev) => {
        const next = new Set(prev);
        next.delete(courseId);
        return next;
      });
    }
  };

  const handleBulkIndex = async (ids: string[]) => {
    const idSet = new Set(ids);
    setIndexingIds((prev) => new Set([...prev, ...ids]));
    try {
      const result = await bulkIndexMutation.mutateAsync(ids);
      if (result.failed === 0) {
        toast.success(t('bulkIndexSuccess', { count: result.indexed }));
      } else {
        toast.warning(
          t('bulkIndexPartial', { indexed: result.indexed, failed: result.failed }),
        );
      }
      setSelectedIds(new Set());
    } finally {
      setIndexingIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
    }
  };

  const allSelected = items.length > 0 && selectedIds.size === items.length;
  const someSelected = selectedIds.size > 0;

  // ── Render ──

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Brain className="text-primary h-6 w-6" />
          <div>
            <h1 className="text-2xl font-bold">{t('title')}</h1>
            <p className="text-muted-foreground text-sm">{t('description')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            {t('refresh')}
          </Button>
          {unindexedCount > 0 && (
            <Button
              onClick={() =>
                handleBulkIndex(
                  items.filter((i) => i.chunkCount === 0).map((i) => i.courseId),
                )
              }
              disabled={bulkIndexMutation.isPending}
            >
              {bulkIndexMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Brain className="mr-2 h-4 w-4" />
              )}
              {t('indexAllUnindexed', { count: unindexedCount })}
            </Button>
          )}
        </div>
      </div>

      {/* Stats summary */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
              {t('totalCourses')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{items.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
              {t('indexedCourses')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-accent-emerald text-2xl font-bold">
              {items.filter((i) => i.chunkCount > 0).length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
              {t('notIndexed')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-destructive text-2xl font-bold">{unindexedCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Bulk action bar (appears when items are selected) */}
      {someSelected && (
        <div className="bg-primary/5 border-primary/20 flex items-center justify-between rounded-lg border px-4 py-2">
          <span className="text-sm font-medium">
            {t('selectedCount', { count: selectedIds.size })}
          </span>
          <Button
            size="sm"
            onClick={() => handleBulkIndex(Array.from(selectedIds))}
            disabled={bulkIndexMutation.isPending}
          >
            {bulkIndexMutation.isPending ? (
              <Loader2 className="mr-2 h-3 w-3 animate-spin" />
            ) : (
              <Brain className="mr-2 h-3 w-3" />
            )}
            {t('indexSelected', { count: selectedIds.size })}
          </Button>
        </div>
      )}

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-border border-b text-left text-xs font-medium uppercase tracking-wide">
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="cursor-pointer"
                    disabled={isLoading}
                  />
                </th>
                <th className="px-4 py-3">{t('course')}</th>
                <th className="px-4 py-3">{t('status')}</th>
                <th className="px-4 py-3">{t('chunks')}</th>
                <th className="px-4 py-3">{t('lastIndexed')}</th>
                <th className="px-4 py-3 text-right">{t('action')}</th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {isLoading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      <td className="px-4 py-3" colSpan={6}>
                        <Skeleton className="h-8 w-full" />
                      </td>
                    </tr>
                  ))
                : items.map((item) => (
                    <CourseIndexRow
                      key={item.courseId}
                      item={item}
                      selected={selectedIds.has(item.courseId)}
                      indexing={indexingIds.has(item.courseId)}
                      onSelect={(checked) => handleSelectOne(item.courseId, checked)}
                      onIndex={() => handleIndexOne(item.courseId)}
                      t={t}
                    />
                  ))}
              {!isLoading && items.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-muted-foreground px-4 py-8 text-center text-sm">
                    {t('noCourses')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ── Sub-component ──

interface CourseIndexRowProps {
  item: IndexStatusItem;
  selected: boolean;
  indexing: boolean;
  onSelect: (checked: boolean) => void;
  onIndex: () => void;
  t: ReturnType<typeof useTranslations<'aiIndexing'>>;
}

function CourseIndexRow({
  item,
  selected,
  indexing,
  onSelect,
  onIndex,
  t,
}: CourseIndexRowProps) {
  const isIndexed = item.chunkCount > 0;

  const lastIndexedLabel = item.lastIndexed
    ? new Date(item.lastIndexed).toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : t('never');

  return (
    <tr className="hover:bg-muted/30 transition-colors">
      <td className="px-4 py-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={(e) => onSelect(e.target.checked)}
          disabled={indexing}
          className="cursor-pointer"
        />
      </td>
      <td className="px-4 py-3">
        <p className="text-sm font-medium">{item.title}</p>
        <p className="text-muted-foreground text-xs font-mono">{item.courseId}</p>
      </td>
      <td className="px-4 py-3">
        {indexing ? (
          <Badge variant="outline" className="gap-1 text-xs">
            <Loader2 className="h-3 w-3 animate-spin" />
            {t('indexing')}
          </Badge>
        ) : isIndexed ? (
          <Badge variant="default" className="gap-1 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-xs border-0">
            <CheckCircle2 className="h-3 w-3" />
            {t('indexed')}
          </Badge>
        ) : (
          <Badge variant="outline" className="gap-1 text-xs border-destructive/50 text-destructive">
            <AlertCircle className="h-3 w-3" />
            {t('notIndexed')}
          </Badge>
        )}
      </td>
      <td className="px-4 py-3 text-sm">
        {isIndexed ? (
          <span className="font-medium">{item.chunkCount.toLocaleString()}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-sm text-muted-foreground">{lastIndexedLabel}</td>
      <td className="px-4 py-3 text-right">
        <Button
          size="sm"
          variant="outline"
          onClick={onIndex}
          disabled={indexing}
        >
          {indexing ? (
            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="mr-1 h-3 w-3" />
          )}
          {isIndexed ? t('reIndex') : t('indexNow')}
        </Button>
      </td>
    </tr>
  );
}
```

---

## 5. Admin Sidebar — thêm nav item

**File:** `apps/management-portal/src/components/navigation/sidebar.tsx`

Import thêm `Brain` từ lucide-react:
```typescript
import { Brain, /* existing imports */ } from 'lucide-react';
```

Thêm vào `adminNav` array (sau `analytics`, trước `settings`):
```typescript
{ label: 'aiIndexing', href: '/admin/ai-indexing', icon: Brain },
```

---

## 6. i18n Keys

### 6a. vi.json — nav namespace

**File:** `apps/management-portal/messages/vi.json`

```json
// Trong "nav" object, thêm:
"aiIndexing": "AI Indexing"
```

### 6b. en.json — nav namespace

```json
// Trong "nav" object:
"aiIndexing": "AI Indexing"
```

### 6c. vi.json — aiIndexing namespace (mới)

```json
"aiIndexing": {
  "title": "AI Content Indexing",
  "description": "Quản lý trạng thái indexing nội dung khóa học cho AI Tutor",
  "refresh": "Làm mới",
  "indexAllUnindexed": "Index tất cả chưa index ({count})",
  "indexSelected": "Index đã chọn ({count})",
  "totalCourses": "Tổng khóa học",
  "indexedCourses": "Đã index",
  "notIndexed": "Chưa index",
  "course": "Khóa học",
  "status": "Trạng thái",
  "chunks": "Số chunks",
  "lastIndexed": "Index lần cuối",
  "action": "Thao tác",
  "indexed": "Đã index",
  "notIndexed": "Chưa index",
  "indexing": "Đang index...",
  "never": "Chưa bao giờ",
  "reIndex": "Re-index",
  "indexNow": "Index ngay",
  "noCourses": "Không có khóa học nào đã publish",
  "selectedCount": "Đã chọn {count} khóa học",
  "indexSuccess": "Index thành công",
  "bulkIndexSuccess": "Đã index thành công {count} khóa học",
  "bulkIndexPartial": "Index hoàn tất: {indexed} thành công, {failed} thất bại"
}
```

### 6d. en.json — aiIndexing namespace (mới)

```json
"aiIndexing": {
  "title": "AI Content Indexing",
  "description": "Manage AI Tutor indexing status for published courses",
  "refresh": "Refresh",
  "indexAllUnindexed": "Index All Unindexed ({count})",
  "indexSelected": "Index Selected ({count})",
  "totalCourses": "Total Courses",
  "indexedCourses": "Indexed",
  "notIndexed": "Not Indexed",
  "course": "Course",
  "status": "Status",
  "chunks": "Chunks",
  "lastIndexed": "Last Indexed",
  "action": "Action",
  "indexed": "Indexed",
  "notIndexed": "Not Indexed",
  "indexing": "Indexing...",
  "never": "Never",
  "reIndex": "Re-index",
  "indexNow": "Index Now",
  "noCourses": "No published courses found",
  "selectedCount": "{count} courses selected",
  "indexSuccess": "Indexed successfully",
  "bulkIndexSuccess": "Successfully indexed {count} courses",
  "bulkIndexPartial": "Indexing complete: {indexed} succeeded, {failed} failed"
}
```

---

## 7. Thứ tự implement

```
1. Backend:
   a. Tạo BulkIndexDto
   b. Thêm getIndexStatus() + bulkIndexCourses() vào EmbeddingsService
   c. Thêm 2 endpoints vào AiTutorController

2. Shared packages:
   a. Thêm types + methods vào aiTutorService
   b. Thêm 3 hooks vào use-ai-tutor.ts
   c. Export từ index.ts

3. Management Portal:
   a. Thêm i18n keys (vi.json + en.json)
   b. Thêm Brain icon + aiIndexing nav item vào sidebar.tsx
   c. Tạo page.tsx mới

4. Verify: npx tsc --noEmit cho cả api + management-portal
```

---

## 8. Checklist

- [ ] `BulkIndexDto` created
- [ ] `EmbeddingsService.getIndexStatus()` — raw SQL aggregate query
- [ ] `EmbeddingsService.bulkIndexCourses()` — sequential index with error collection
- [ ] `GET /ai/tutor/courses/index-status` — admin only
- [ ] `POST /ai/tutor/index/bulk` — admin only
- [ ] `aiTutorService` — getIndexStatus, indexCourse, bulkIndex methods + types
- [ ] `useIndexStatus`, `useIndexCourse`, `useBulkIndexCourses` hooks exported
- [ ] `/admin/ai-indexing/page.tsx` — page + CourseIndexRow sub-component
- [ ] Sidebar: Brain icon + aiIndexing nav item
- [ ] i18n: nav.aiIndexing (vi+en), aiIndexing namespace (vi+en)
- [ ] TypeScript clean on api + management-portal

---

## 9. Notes

### Route conflict avoidance
`GET /ai/tutor/courses/index-status` (method GET) và `POST /ai/tutor/index/:courseId` (method POST) — không conflict vì khác HTTP method. Tuy nhiên nên để `courses/index-status` trước `index/:courseId` trong controller để rõ ràng.

### Per-row loading state
Do `useIndexCourse()` là một mutation dùng chung, không tự track loading per courseId. Dùng local `indexingIds: Set<string>` state trong page component để track từng row riêng biệt.

### Indexing duration
`indexCourseContent()` có thể chạy vài giây đến vài phút tùy số lessons và file size. `mutateAsync()` sẽ block đến khi xong. Frontend hiện loading spinner trong suốt thời gian này — acceptable cho admin UI.

### Auto-refresh
`useIndexStatus()` có `refetchInterval: 30_000` — tự refresh mỗi 30s để cập nhật trạng thái sau khi index xong. Admin cũng có thể click "Làm mới" thủ công.

### Bulk index sequential vs parallel
Backend chạy sequential (không parallel) để tránh OOM khi nhiều courses có FILE lessons cần download + extract. Sequential cũng dễ handle errors per course.
