/**
 * Chuyển video cũ (public, type=upload) sang authenticated + backfill Lesson.videoPublicId.
 *
 * Sau khi chạy: link public cũ đã share sẽ CHẾT, chỉ xem được qua URL đã ký.
 * Mặc định dry-run (chỉ in ra). Chạy thật: thêm cờ --apply.
 *
 *   cd apps/api
 *   npx ts-node src/scripts/migrate-videos-to-authenticated.ts          # dry-run
 *   npx ts-node src/scripts/migrate-videos-to-authenticated.ts --apply  # chạy thật
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { PrismaClient } from '@prisma/client';
import { v2 as cloudinary } from 'cloudinary';

// Nạp .env thủ công (project không có dotenv)
function loadEnv() {
  try {
    const raw = readFileSync(join(__dirname, '../../.env'), 'utf8');
    for (const line of raw.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      const key = m?.[1];
      const value = m?.[2];
      if (key && value !== undefined && !process.env[key]) {
        process.env[key] = value.replace(/^["']|["']$/g, '');
      }
    }
  } catch {
    // .env không có thì dựa vào env sẵn có
  }
}

// Tách public_id từ URL Cloudinary: .../upload/[transform/]v123/<public_id>.<ext>
function extractPublicId(url: string): string | null {
  const afterUpload = url.split('/upload/')[1];
  if (!afterUpload) return null;
  const withVersion = afterUpload.match(/(?:^|.*?\/)v\d+\/(.+)$/);
  const path = withVersion?.[1] ?? afterUpload;
  return path.replace(/\.[a-zA-Z0-9]+$/, '') || null;
}

async function main() {
  loadEnv();
  const apply = process.argv.includes('--apply');

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

  const prisma = new PrismaClient();

  // Video cũ = có videoUrl nhưng chưa có videoPublicId
  const lessons = await prisma.lesson.findMany({
    where: { videoUrl: { not: null }, videoPublicId: null },
    select: { id: true, title: true, videoUrl: true },
  });

  console.log(`[migrate] ${apply ? 'APPLY' : 'DRY-RUN'} — tìm thấy ${lessons.length} video cũ\n`);

  let ok = 0;
  let skipped = 0;
  let failed = 0;

  for (const lesson of lessons) {
    const publicId = extractPublicId(lesson.videoUrl!);
    if (!publicId) {
      console.warn(`  ⚠️  SKIP ${lesson.id} — không tách được public_id từ ${lesson.videoUrl}`);
      skipped++;
      continue;
    }

    if (!apply) {
      console.log(`  • ${lesson.id} "${lesson.title}" → publicId=${publicId}`);
      continue;
    }

    try {
      // Đổi delivery type upload(public) → authenticated
      await cloudinary.uploader.rename(publicId, publicId, {
        resource_type: 'video',
        type: 'upload',
        to_type: 'authenticated',
        invalidate: true,
      });
      await prisma.lesson.update({
        where: { id: lesson.id },
        data: { videoPublicId: publicId },
      });
      console.log(`  ✅ ${lesson.id} → authenticated (${publicId})`);
      ok++;
    } catch (e) {
      console.error(`  ❌ ${lesson.id} — ${(e as Error).message}`);
      failed++;
    }
  }

  console.log(
    `\n[migrate] Xong. ok=${ok} skipped=${skipped} failed=${failed} total=${lessons.length}`,
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
