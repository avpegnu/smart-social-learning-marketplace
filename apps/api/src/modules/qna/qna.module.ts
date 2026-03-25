import { Module } from '@nestjs/common';
import { NotificationsModule } from '@/modules/notifications/notifications.module';
import { QuestionsService } from './questions/questions.service';
import { AnswersService } from './answers/answers.service';
import { QuestionsController } from './questions/questions.controller';
import { AnswersController } from './answers/answers.controller';

@Module({
  imports: [NotificationsModule],
  controllers: [QuestionsController, AnswersController],
  providers: [QuestionsService, AnswersService],
  exports: [QuestionsService],
})
export class QnaModule {}
