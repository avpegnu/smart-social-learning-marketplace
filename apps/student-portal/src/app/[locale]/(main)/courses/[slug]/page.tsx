'use client';

import { use } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { BookOpen, CheckCircle2, ChevronRight, ShoppingCart } from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Avatar,
  AvatarFallback,
  AvatarImage,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@shared/ui';
import { PriceDisplay } from '@/components/course/price-display';
import { CourseDetailSkeleton } from '@/components/course/detail/course-detail-skeleton';
import { CourseHero } from '@/components/course/detail/course-hero';
import { CourseCurriculum } from '@/components/course/detail/course-curriculum';
import { CourseReviews } from '@/components/course/detail/course-reviews';
import { PurchaseCard } from '@/components/course/detail/purchase-card';
import type { ApiCourse } from '@/components/course/detail/types';
import {
  useCourseDetail,
  useEnrollmentCheck,
  useEnrollFree,
  useAuthStore,
  useCartStore,
} from '@shared/hooks';
import { toast } from 'sonner';

export default function CourseDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const t = useTranslations('courseDetail');
  const router = useRouter();

  const { data: courseData, isLoading } = useCourseDetail(slug);
  const course = courseData?.data as ApiCourse | undefined;

  // Enrollment + Cart
  const { isAuthenticated } = useAuthStore();
  const cartItems = useCartStore((s) => s.items);
  const addToCart = useCartStore((s) => s.addItem);
  const { data: enrollmentData } = useEnrollmentCheck(course?.id ?? '');
  const enrollFreeMutation = useEnrollFree();

  const isEnrolled = (enrollmentData?.data as { enrolled: boolean } | undefined)?.enrolled === true;
  const isInCart = cartItems.some((item) => item.courseId === course?.id);

  if (isLoading) return <CourseDetailSkeleton />;

  if (!course) {
    return (
      <div className="py-24 text-center">
        <BookOpen className="text-muted-foreground/50 mx-auto mb-4 h-16 w-16" />
        <h2 className="mb-2 text-xl font-semibold">{t('notFound')}</h2>
      </div>
    );
  }

  const handleAddToCart = () => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    addToCart({
      courseId: course.id,
      title: course.title,
      instructorName: course.instructor.fullName,
      thumbnailUrl: course.thumbnailUrl ?? '',
      price: course.price,
      type: 'FULL_COURSE',
    });
    toast.success(t('addedToCart'));
  };

  const handleEnrollFree = () => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    enrollFreeMutation.mutate(course.id, {
      onSuccess: () => toast.success(t('enrolled')),
    });
  };

  const coursePrice = course.price;

  function renderCTA(size: 'default' | 'full' = 'default') {
    const btnClass = size === 'full' ? 'w-full gap-2' : 'flex-1 gap-2';

    if (isEnrolled) {
      return (
        <Button className={btnClass} onClick={() => router.push('/my-learning')}>
          {t('continueLearning')}
        </Button>
      );
    }
    if (isInCart) {
      return (
        <Button variant="secondary" className={btnClass} onClick={() => router.push('/cart')}>
          <ShoppingCart className="h-4 w-4" />
          {t('goToCart')}
        </Button>
      );
    }
    if (coursePrice === 0) {
      return (
        <Button
          className={btnClass}
          onClick={handleEnrollFree}
          disabled={enrollFreeMutation.isPending}
        >
          {enrollFreeMutation.isPending ? t('enrolling') : t('enrollFree')}
        </Button>
      );
    }
    return (
      <Button className={btnClass} onClick={handleAddToCart}>
        <ShoppingCart className="h-4 w-4" />
        {t('addToCart')}
      </Button>
    );
  }

  const instructorProfile = course.instructor.instructorProfile;
  const instructorInitial = course.instructor.fullName.split(' ').pop()?.[0] ?? '';

  return (
    <div>
      <CourseHero course={course} />

      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col gap-8 lg:flex-row">
          {/* Main content */}
          <div className="min-w-0 flex-1">
            <Tabs defaultValue="overview">
              <TabsList className="mb-6 w-full justify-start overflow-x-auto">
                <TabsTrigger value="overview">{t('overview')}</TabsTrigger>
                <TabsTrigger value="content">{t('content')}</TabsTrigger>
                <TabsTrigger value="reviews">
                  {t('reviews')} ({course.reviewCount})
                </TabsTrigger>
              </TabsList>

              {/* Overview Tab */}
              <TabsContent value="overview">
                {course.learningOutcomes && course.learningOutcomes.length > 0 && (
                  <Card className="mb-6">
                    <CardHeader>
                      <CardTitle className="text-lg">{t('whatYouLearn')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {course.learningOutcomes.map((item, i) => (
                          <div key={i} className="flex items-start gap-2">
                            <CheckCircle2 className="text-success mt-0.5 h-5 w-5 shrink-0" />
                            <span className="text-sm">{item}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {course.description && (
                  <div className="mb-6">
                    <h2 className="mb-3 text-lg font-semibold">{t('description')}</h2>
                    <div
                      className="prose prose-sm dark:prose-invert max-w-none"
                      dangerouslySetInnerHTML={{ __html: course.description }}
                    />
                  </div>
                )}

                {course.prerequisites && course.prerequisites.length > 0 && (
                  <div className="mb-6">
                    <h2 className="mb-3 text-lg font-semibold">{t('prerequisites')}</h2>
                    <ul className="space-y-2">
                      {course.prerequisites.map((item, i) => (
                        <li
                          key={i}
                          className="text-muted-foreground flex items-center gap-2 text-sm"
                        >
                          <ChevronRight className="text-primary h-4 w-4" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Instructor */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">{t('instructor')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-start gap-4">
                      <Avatar className="h-16 w-16">
                        {course.instructor.avatarUrl && (
                          <AvatarImage
                            src={course.instructor.avatarUrl}
                            alt={course.instructor.fullName}
                          />
                        )}
                        <AvatarFallback className="bg-primary text-primary-foreground text-lg">
                          {instructorInitial}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h3 className="font-semibold">{course.instructor.fullName}</h3>
                        {instructorProfile?.headline && (
                          <p className="text-muted-foreground text-sm">
                            {instructorProfile.headline}
                          </p>
                        )}
                        {instructorProfile?.biography && (
                          <p className="text-muted-foreground mt-3 text-sm">
                            {instructorProfile.biography}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Content Tab */}
              <TabsContent value="content">
                <CourseCurriculum
                  sections={course.sections}
                  totalLessons={course.totalLessons}
                  totalDuration={course.totalDuration}
                />
              </TabsContent>

              {/* Reviews Tab */}
              <TabsContent value="reviews">
                <CourseReviews
                  courseId={course.id}
                  avgRating={course.avgRating}
                  reviewCount={course.reviewCount}
                  embeddedReviews={course.reviews ?? []}
                />
              </TabsContent>
            </Tabs>
          </div>

          {/* Purchase Card - Desktop */}
          <div className="hidden w-80 shrink-0 lg:block">
            <div className="sticky top-20">
              <PurchaseCard
                thumbnailUrl={course.thumbnailUrl}
                title={course.title}
                price={course.price}
                originalPrice={course.originalPrice ?? undefined}
                totalDuration={course.totalDuration}
                totalLessons={course.totalLessons}
                ctaButton={renderCTA('full')}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Mobile sticky bottom bar */}
      <div className="bg-background border-border fixed right-0 bottom-0 left-0 z-30 border-t p-4 lg:hidden">
        <div className="flex items-center gap-4">
          <PriceDisplay
            price={course.price}
            originalPrice={course.originalPrice ?? undefined}
            size="md"
          />
          {renderCTA()}
        </div>
      </div>
    </div>
  );
}
