import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { publicFetch } from '@shared/api-client';
import type { ApiResponse } from '@shared/api-client';
import { CoursesClient } from './courses-client';
import { parseCourseFilters, buildCourseApiParams, type CourseListSearchParams } from './params';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'courses' });
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  };
}

// SSR động: trang phụ thuộc searchParams (bộ lọc/trang) nên render theo request.
// Vẫn trả HTML có nội dung thật ngay lần đầu (SEO) nhờ fetch server + seed initialData.
export default async function CoursesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<CourseListSearchParams>;
}) {
  await params;
  const sp = await searchParams;

  const initialFilters = parseCourseFilters(sp);
  const initialParams = buildCourseApiParams(initialFilters);
  const query = new URLSearchParams(initialParams).toString();

  let initialData: ApiResponse<unknown> | undefined;
  try {
    initialData = await publicFetch(`/courses?${query}`, { revalidate: 300 });
  } catch {
    initialData = undefined;
  }

  return (
    <CoursesClient
      initialFilters={initialFilters}
      initialParams={initialParams}
      initialData={initialData}
    />
  );
}
