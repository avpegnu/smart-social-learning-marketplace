import { Module } from '@nestjs/common';
import { CoursePlayerController } from './course-player/course-player.controller';
import { ProgressController } from './progress/progress.controller';
import { QuizAttemptsController } from './quiz-attempts/quiz-attempts.controller';
import { CertificatesController } from './certificates/certificates.controller';
import { StreaksController } from './streaks/streaks.controller';
import { PlacementTestsController } from './placement-tests/placement-tests.controller';
import { CoursePlayerService } from './course-player/course-player.service';
import { ProgressService } from './progress/progress.service';
import { QuizAttemptsService } from './quiz-attempts/quiz-attempts.service';
import { CertificatesService } from './certificates/certificates.service';
import { StreaksService } from './streaks/streaks.service';
import { PlacementTestsService } from './placement-tests/placement-tests.service';

@Module({
  controllers: [
    CoursePlayerController,
    ProgressController,
    QuizAttemptsController,
    CertificatesController,
    StreaksController,
    PlacementTestsController,
  ],
  providers: [
    CoursePlayerService,
    ProgressService,
    QuizAttemptsService,
    CertificatesService,
    StreaksService,
    PlacementTestsService,
  ],
  exports: [ProgressService, CertificatesService],
})
export class LearningModule {}
