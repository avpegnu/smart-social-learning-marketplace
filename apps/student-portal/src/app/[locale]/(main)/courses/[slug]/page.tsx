import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { publicFetch } from '@shared/api-client';
import type { ApiCourse } from '@/components/course/detail/types';
import { CourseDetailClient } from './course-detail-client';

// ISR: render sẵn HTML (có nội dung thật) và cache, tự làm mới mỗi 5 phút.
// Nội dung công khai + ít đổi → SEO tốt như SSR nhưng nhẹ server hơn.
export const revalidate = 300;

async function getCourse(slug: string): Promise<{ data: ApiCourse } | null> {
  try {
    return await publicFetch<ApiCourse>(`/courses/${slug}`, { revalidate });
  } catch {
    // 404 / lỗi khác → để page quyết định (notFound / metadata rỗng).
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const res = await getCourse(slug);
  const course = res?.data;
  if (!course) return {};

  const description = course.shortDescription ?? undefined;

  return {
    title: course.title,
    description,
    openGraph: {
      title: course.title,
      description,
      type: 'website',
      ...(course.thumbnailUrl ? { images: [{ url: course.thumbnailUrl }] } : {}),
    },
  };
}

export default async function CourseDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const res = await getCourse(slug);
  if (!res?.data) notFound();

  return <CourseDetailClient slug={slug} initialCourse={res} />;
}
