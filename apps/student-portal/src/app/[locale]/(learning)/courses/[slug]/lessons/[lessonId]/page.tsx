'use client';

import { useTranslations } from 'next-intl';
import { ChevronLeft, ChevronRight, CheckCircle2, Play, Monitor } from 'lucide-react';
import { Button } from '@shared/ui';
import { LearningSidebar } from '@/components/navigation/sidebar';
import { mockCourses } from '@/lib/mock-data';
import { useState } from 'react';
import { cn } from '@/lib/utils';

export default function LessonPlayerPage() {
  const t = useTranslations('learning');
  const course = mockCourses[0];
  const [activeTab, setActiveTab] = useState('curriculum');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const sections = course.sections.map((section, si) => ({
    ...section,
    lessons: section.lessons.map((lesson, li) => ({
      ...lesson,
      isCompleted: si === 0 && li < 2,
      isActive: si === 0 && li === 2,
    })),
  }));

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      {/* Video Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Video Player Placeholder */}
        <div className="relative flex aspect-video max-h-[70vh] items-center justify-center bg-black">
          <div className="text-center text-white/60">
            <Monitor className="mx-auto mb-3 h-16 w-16" />
            <p className="text-lg font-medium">{t('videoPlaceholder')}</p>
            <p className="mt-1 text-sm">{course.sections[0].lessons[2]?.title}</p>
          </div>
          {/* Play button overlay */}
          <button className="group absolute inset-0 flex cursor-pointer items-center justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/20 transition-colors group-hover:bg-white/30">
              <Play className="ml-1 h-8 w-8 fill-white text-white" />
            </div>
          </button>
        </div>

        {/* Below video content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="max-w-3xl">
            <h2 className="mb-2 text-xl font-semibold">
              {course.sections[0].lessons[2]?.title || 'Lesson Title'}
            </h2>
            <p className="text-muted-foreground mb-6 text-sm">{t('lessonDescription')}</p>

            {/* Navigation */}
            <div className="flex items-center justify-between">
              <Button variant="outline" className="gap-2">
                <ChevronLeft className="h-4 w-4" />
                {t('previousLesson')}
              </Button>
              <Button variant="outline" className="gap-2">
                <CheckCircle2 className="h-4 w-4" />
                {t('markComplete')}
              </Button>
              <Button className="gap-2">
                {t('nextLesson')}
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Sidebar */}
      <div className={cn('transition-all duration-300', sidebarOpen ? 'w-80 lg:w-96' : 'w-0')}>
        {sidebarOpen && (
          <LearningSidebar
            sections={sections}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            onLessonClick={(id) => console.warn('Navigate to lesson:', id)}
          />
        )}
      </div>

      {/* Sidebar toggle (mobile) */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="bg-primary text-primary-foreground fixed right-4 bottom-20 z-30 flex h-12 w-12 cursor-pointer items-center justify-center rounded-full shadow-lg md:hidden"
      >
        {sidebarOpen ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
      </button>
    </div>
  );
}
