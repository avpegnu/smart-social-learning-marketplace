'use client';

import { useTranslations } from 'next-intl';
import {
  Star,
  Users,
  Clock,
  BookOpen,
  Globe,
  Calendar,
  CheckCircle2,
  Play,
  ChevronDown,
  ChevronRight,
  ShoppingCart,
  Heart,
  Share2,
  Monitor,
  FileText,
  Award,
  Infinity as InfinityIcon,
  ThumbsUp,
  FileQuestion,
} from 'lucide-react';
import {
  Button,
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Avatar,
  AvatarFallback,
  Separator,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Progress,
} from '@shared/ui';
import { PriceDisplay } from '@/components/course/price-display';
import { mockCourses, mockReviews } from '@/lib/mock-data';
import { cn } from '@/lib/utils';
import { useState } from 'react';

const lessonIcons = {
  video: Play,
  quiz: FileQuestion,
  exercise: FileText,
  reading: BookOpen,
};

export default function CourseDetailPage() {
  const t = useTranslations('courseDetail');
  const course = mockCourses[0];
  const [expandedSections, setExpandedSections] = useState<string[]>([course.sections[0]?.id]);

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) =>
      prev.includes(sectionId) ? prev.filter((id) => id !== sectionId) : [...prev, sectionId],
    );
  };

  const ratingDistribution = [
    { stars: 5, percentage: 68 },
    { stars: 4, percentage: 22 },
    { stars: 3, percentage: 7 },
    { stars: 2, percentage: 2 },
    { stars: 1, percentage: 1 },
  ];

  return (
    <div>
      {/* Dark Header */}
      <section className="bg-gradient-to-r from-gray-900 to-gray-800 py-8 text-white sm:py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl">
            <div className="mb-3 flex items-center gap-2">
              <Badge variant="secondary" className="border-0 bg-white/20 text-white">
                {course.category}
              </Badge>
              {course.isBestseller && (
                <Badge className="bg-warning text-warning-foreground">{t('bestseller')}</Badge>
              )}
            </div>
            <h1 className="mb-4 text-2xl font-bold sm:text-3xl lg:text-4xl">{course.title}</h1>
            <p className="mb-4 text-gray-300">{course.shortDescription}</p>

            <div className="flex flex-wrap items-center gap-4 text-sm">
              <div className="flex items-center gap-1">
                <span className="text-warning font-bold">{course.rating}</span>
                <div className="flex">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={cn(
                        'h-4 w-4',
                        star <= Math.floor(course.rating)
                          ? 'fill-warning text-warning'
                          : 'text-gray-500',
                      )}
                    />
                  ))}
                </div>
                <span className="text-gray-400">
                  ({course.totalRatings.toLocaleString('en-US')} {t('ratings')})
                </span>
              </div>
              <div className="flex items-center gap-1 text-gray-300">
                <Users className="h-4 w-4" />
                {course.totalStudents.toLocaleString('en-US')} {t('students')}
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-gray-300">
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {course.totalDuration}
              </span>
              <span className="flex items-center gap-1">
                <BookOpen className="h-4 w-4" />
                {course.totalLessons} {t('lessons')}
              </span>
              <span className="flex items-center gap-1">
                <Globe className="h-4 w-4" />
                {course.language === 'vi' ? 'Tiếng Việt' : 'English'}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {t('updated')} {course.updatedAt}
              </span>
            </div>

            <div className="mt-4 flex items-center gap-2">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary/30 text-xs text-white">
                  {course.instructor.name.split(' ').pop()?.[0]}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm">{course.instructor.name}</span>
            </div>
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col gap-8 lg:flex-row">
          {/* Main content */}
          <div className="min-w-0 flex-1">
            <Tabs defaultValue="overview">
              <TabsList className="mb-6 w-full justify-start overflow-x-auto">
                <TabsTrigger value="overview">{t('overview')}</TabsTrigger>
                <TabsTrigger value="content">{t('content')}</TabsTrigger>
                <TabsTrigger value="reviews">{t('reviews')}</TabsTrigger>
                <TabsTrigger value="qna">{t('qna')}</TabsTrigger>
              </TabsList>

              {/* Overview Tab */}
              <TabsContent value="overview">
                {/* What you'll learn */}
                <Card className="mb-6">
                  <CardHeader>
                    <CardTitle className="text-lg">{t('whatYouLearn')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {course.whatYouLearn.map((item, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <CheckCircle2 className="text-success mt-0.5 h-5 w-5 shrink-0" />
                          <span className="text-sm">{item}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Description */}
                <div className="mb-6">
                  <h2 className="mb-3 text-lg font-semibold">{t('description')}</h2>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {course.description}
                  </p>
                </div>

                {/* Prerequisites */}
                <div className="mb-6">
                  <h2 className="mb-3 text-lg font-semibold">{t('prerequisites')}</h2>
                  <ul className="space-y-2">
                    {course.prerequisites.map((item, i) => (
                      <li key={i} className="text-muted-foreground flex items-center gap-2 text-sm">
                        <ChevronRight className="text-primary h-4 w-4" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Instructor */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">{t('instructor')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-start gap-4">
                      <Avatar className="h-16 w-16">
                        <AvatarFallback className="bg-primary text-primary-foreground text-lg">
                          {course.instructor.name.split(' ').pop()?.[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h3 className="font-semibold">{course.instructor.name}</h3>
                        <p className="text-muted-foreground text-sm">{course.instructor.title}</p>
                        <div className="text-muted-foreground mt-2 flex items-center gap-4 text-sm">
                          <span className="flex items-center gap-1">
                            <Star className="fill-warning text-warning h-4 w-4" />
                            {course.instructor.rating}
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="h-4 w-4" />
                            {course.instructor.totalStudents.toLocaleString('en-US')}
                          </span>
                          <span className="flex items-center gap-1">
                            <BookOpen className="h-4 w-4" />
                            {course.instructor.totalCourses}
                          </span>
                        </div>
                        <p className="text-muted-foreground mt-3 text-sm">
                          {course.instructor.bio}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Content Tab */}
              <TabsContent value="content">
                <div className="text-muted-foreground mb-4 text-sm">
                  {course.sections.length} {t('sections')} &bull; {course.totalLessons}{' '}
                  {t('lessons')} &bull; {course.totalDuration}
                </div>
                <div className="border-border overflow-hidden rounded-xl border">
                  {course.sections.map((section) => (
                    <div key={section.id} className="border-border border-b last:border-0">
                      <button
                        onClick={() => toggleSection(section.id)}
                        className="hover:bg-accent/50 flex w-full cursor-pointer items-center px-4 py-3 transition-colors"
                      >
                        {expandedSections.includes(section.id) ? (
                          <ChevronDown className="mr-2 h-4 w-4 shrink-0" />
                        ) : (
                          <ChevronRight className="mr-2 h-4 w-4 shrink-0" />
                        )}
                        <span className="flex-1 text-left text-sm font-medium">
                          {section.title}
                        </span>
                        <span className="text-muted-foreground text-xs">
                          {section.lessons.length} {t('lessons')}
                        </span>
                      </button>
                      {expandedSections.includes(section.id) && (
                        <div className="bg-muted/30">
                          {section.lessons.map((lesson) => {
                            const LessonIcon = lessonIcons[lesson.type];
                            return (
                              <div
                                key={lesson.id}
                                className="border-border/50 flex items-center gap-3 border-t px-4 py-2.5 text-sm"
                              >
                                <LessonIcon className="text-muted-foreground h-4 w-4 shrink-0" />
                                <span className="flex-1">{lesson.title}</span>
                                {lesson.isPreview && (
                                  <Badge variant="outline" className="text-xs">
                                    {t('preview')}
                                  </Badge>
                                )}
                                <span className="text-muted-foreground text-xs">
                                  {lesson.duration}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </TabsContent>

              {/* Reviews Tab */}
              <TabsContent value="reviews">
                {/* Rating overview */}
                <Card className="mb-6">
                  <CardContent className="pt-6">
                    <div className="flex flex-col items-center gap-8 sm:flex-row">
                      <div className="text-center">
                        <div className="text-5xl font-bold">{course.rating}</div>
                        <div className="mt-1 flex items-center justify-center gap-0.5">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              className={cn(
                                'h-4 w-4',
                                star <= Math.floor(course.rating)
                                  ? 'fill-warning text-warning'
                                  : 'text-muted',
                              )}
                            />
                          ))}
                        </div>
                        <div className="text-muted-foreground mt-1 text-sm">
                          {course.totalRatings} {t('ratings')}
                        </div>
                      </div>
                      <div className="w-full flex-1 space-y-2">
                        {ratingDistribution.map(({ stars, percentage }) => (
                          <div key={stars} className="flex items-center gap-2">
                            <span className="w-6 text-right text-sm">{stars}</span>
                            <Star className="fill-warning text-warning h-3.5 w-3.5" />
                            <div className="flex-1">
                              <Progress value={percentage} className="h-2" />
                            </div>
                            <span className="text-muted-foreground w-10 text-right text-xs">
                              {percentage}%
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Reviews list */}
                <div className="space-y-4">
                  {mockReviews.map((review) => (
                    <Card key={review.id}>
                      <CardContent className="pt-6">
                        <div className="flex items-start gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback>{review.user.name[0]}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <div className="mb-1 flex items-center gap-2">
                              <span className="text-sm font-medium">{review.user.name}</span>
                              <span className="text-muted-foreground text-xs">{review.date}</span>
                            </div>
                            <div className="mb-2 flex items-center gap-0.5">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <Star
                                  key={star}
                                  className={cn(
                                    'h-3.5 w-3.5',
                                    star <= review.rating
                                      ? 'fill-warning text-warning'
                                      : 'text-muted',
                                  )}
                                />
                              ))}
                            </div>
                            <p className="text-muted-foreground text-sm">{review.comment}</p>
                            <button className="text-muted-foreground hover:text-foreground mt-2 flex cursor-pointer items-center gap-1 text-xs">
                              <ThumbsUp className="h-3.5 w-3.5" />
                              {t('helpful')} ({review.helpful})
                            </button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              {/* Q&A Tab */}
              <TabsContent value="qna">
                <div className="text-muted-foreground py-12 text-center">
                  <FileQuestion className="text-muted-foreground/50 mx-auto mb-3 h-12 w-12" />
                  <p className="font-medium">{t('qnaEmpty')}</p>
                  <p className="mt-1 text-sm">{t('qnaEmptyDesc')}</p>
                  <Button className="mt-4">{t('askQuestion')}</Button>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Purchase Card - Desktop */}
          <div className="hidden w-80 shrink-0 lg:block">
            <div className="sticky top-20">
              <Card>
                <CardContent className="p-6">
                  {/* Preview thumbnail */}
                  <div className="from-primary/20 to-primary/5 mb-4 flex aspect-video items-center justify-center rounded-lg bg-gradient-to-br">
                    <Play className="text-primary/50 h-12 w-12" />
                  </div>

                  <PriceDisplay
                    price={course.price}
                    originalPrice={course.originalPrice}
                    size="lg"
                    className="mb-4"
                  />

                  <div className="space-y-3">
                    <Button className="w-full gap-2">
                      <ShoppingCart className="h-4 w-4" />
                      {t('addToCart')}
                    </Button>
                    <Button variant="outline" className="w-full">
                      {t('buyNow')}
                    </Button>
                  </div>

                  <div className="mt-4 flex items-center justify-center gap-4">
                    <button className="text-muted-foreground hover:text-foreground flex cursor-pointer items-center gap-1 text-sm">
                      <Heart className="h-4 w-4" />
                      {t('wishlist')}
                    </button>
                    <button className="text-muted-foreground hover:text-foreground flex cursor-pointer items-center gap-1 text-sm">
                      <Share2 className="h-4 w-4" />
                      {t('share')}
                    </button>
                  </div>

                  <Separator className="my-4" />

                  <h4 className="mb-3 text-sm font-semibold">{t('includes')}</h4>
                  <ul className="text-muted-foreground space-y-2 text-sm">
                    <li className="flex items-center gap-2">
                      <Monitor className="h-4 w-4" />
                      {course.totalDuration} video
                    </li>
                    <li className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      {course.totalLessons} {t('lessons')}
                    </li>
                    <li className="flex items-center gap-2">
                      <Award className="h-4 w-4" />
                      {t('certificate')}
                    </li>
                    <li className="flex items-center gap-2">
                      <InfinityIcon className="h-4 w-4" />
                      {t('lifetime')}
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile sticky bottom bar */}
      <div className="bg-background border-border fixed right-0 bottom-0 left-0 z-30 border-t p-4 lg:hidden">
        <div className="flex items-center gap-4">
          <PriceDisplay price={course.price} originalPrice={course.originalPrice} size="md" />
          <Button className="flex-1 gap-2">
            <ShoppingCart className="h-4 w-4" />
            {t('addToCart')}
          </Button>
        </div>
      </div>
    </div>
  );
}
