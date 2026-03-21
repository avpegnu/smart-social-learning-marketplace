'use client';

import { use } from 'react';
import { CourseWizard } from '@/components/courses/wizard/course-wizard';

export default function EditCoursePage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = use(params);
  return <CourseWizard mode="edit" courseId={courseId} />;
}
