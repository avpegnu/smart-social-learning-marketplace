import type { LucideIcon } from 'lucide-react';
import { Play, FileText, FileQuestion } from 'lucide-react';

export interface ApiLesson {
  id: string;
  title: string;
  type: string;
  estimatedDuration: number | null;
  order: number;
}

export interface ApiChapter {
  id: string;
  title: string;
  order: number;
  isFreePreview: boolean;
  lessons: ApiLesson[];
}

export interface ApiSection {
  id: string;
  title: string;
  order: number;
  chapters: ApiChapter[];
}

export interface ApiReview {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  user: { id: string; fullName: string; avatarUrl: string | null };
}

export interface ApiCourse {
  id: string;
  title: string;
  slug: string;
  shortDescription: string | null;
  description: string | null;
  thumbnailUrl: string | null;
  price: number;
  originalPrice: number | null;
  avgRating: number;
  reviewCount: number;
  totalStudents: number;
  totalLessons: number;
  totalDuration: number;
  level: string;
  language: string;
  learningOutcomes: string[] | null;
  prerequisites: string[] | null;
  publishedAt: string | null;
  sections: ApiSection[];
  reviews: ApiReview[];
  instructor: {
    id: string;
    fullName: string;
    avatarUrl: string | null;
    instructorProfile?: { headline: string | null; biography: string | null };
  };
  category: { id: string; name: string; slug: string } | null;
  courseTags: Array<{ tag: { id: string; name: string } }>;
}

export const LESSON_ICONS: Record<string, LucideIcon> = {
  VIDEO: Play,
  TEXT: FileText,
  QUIZ: FileQuestion,
};
