import { use } from 'react';
import { redirect } from 'next/navigation';
import { routing } from '@/i18n/routing';

export default function CourseStudentsPage({
  params,
}: {
  params: Promise<{ courseId: string; locale: string }>;
}) {
  const { courseId, locale } = use(params);
  const prefix = locale === routing.defaultLocale ? '' : `/${locale}`;
  redirect(`${prefix}/instructor/courses/${courseId}?tab=students`);
}
