import { Module } from '@nestjs/common';
import { JobsModule } from '@/modules/jobs/jobs.module';
import { SocialModule } from '@/modules/social/social.module';
import { CoursesController } from './browse/courses.controller';
import { CourseManagementController } from './management/course-management.controller';
import { SectionsController } from './sections/sections.controller';
import { ChaptersController } from './chapters/chapters.controller';
import { LessonsController } from './lessons/lessons.controller';
import { QuizzesController } from './quizzes/quizzes.controller';
import { ReviewsController } from './reviews/reviews.controller';
import { CoursesService } from './browse/courses.service';
import { CourseManagementService } from './management/course-management.service';
import { SectionsService } from './sections/sections.service';
import { ChaptersService } from './chapters/chapters.service';
import { LessonsService } from './lessons/lessons.service';
import { QuizzesService } from './quizzes/quizzes.service';
import { ReviewsService } from './reviews/reviews.service';

@Module({
  imports: [JobsModule, SocialModule],
  controllers: [
    CoursesController,
    CourseManagementController,
    SectionsController,
    ChaptersController,
    LessonsController,
    QuizzesController,
    ReviewsController,
  ],
  providers: [
    CoursesService,
    CourseManagementService,
    SectionsService,
    ChaptersService,
    LessonsService,
    QuizzesService,
    ReviewsService,
  ],
  exports: [CoursesService, CourseManagementService],
})
export class CoursesModule {}
