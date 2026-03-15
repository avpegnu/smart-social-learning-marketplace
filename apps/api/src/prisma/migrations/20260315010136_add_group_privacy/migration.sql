-- CreateEnum
CREATE TYPE "GroupPrivacy" AS ENUM ('PUBLIC', 'PRIVATE');

-- AlterTable
ALTER TABLE "groups" ADD COLUMN     "privacy" "GroupPrivacy" NOT NULL DEFAULT 'PUBLIC';
