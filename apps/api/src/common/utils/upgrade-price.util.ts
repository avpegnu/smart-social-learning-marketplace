import type { PrismaService } from '@/prisma/prisma.service';

export interface UpgradeInfo {
  /** Full course price. */
  coursePrice: number;
  /** Sum of the current price of every chapter the user already owns in this course. */
  credit: number;
  /** Amount still owed to unlock the full course: `max(0, coursePrice - credit)`. */
  upgradePrice: number;
  /** Ids of the chapters the user has purchased in this course. */
  purchasedChapterIds: string[];
}

/**
 * Single source of truth for "upgrade to full course" pricing. A learner who
 * bought individual chapters (PARTIAL enrollment) should only pay the remaining
 * value of the course, crediting the chapters they already own at their current
 * listed price. Used by course-detail (checkEnrollment), the learning dashboard,
 * and cart pricing so all three agree.
 */
export async function computeUpgradeInfo(
  prisma: PrismaService,
  userId: string,
  courseId: string,
  coursePrice: number,
): Promise<UpgradeInfo> {
  const owned = await prisma.chapterPurchase.findMany({
    where: { userId, chapter: { section: { courseId } } },
    select: { chapterId: true, chapter: { select: { price: true } } },
  });
  const credit = owned.reduce((sum, o) => sum + (o.chapter.price ?? 0), 0);
  return {
    coursePrice,
    credit,
    upgradePrice: Math.max(0, coursePrice - credit),
    purchasedChapterIds: owned.map((o) => o.chapterId),
  };
}
