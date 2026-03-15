import { Module } from '@nestjs/common';
import { QuestionsService } from './questions/questions.service';
import { AnswersService } from './answers/answers.service';
import { QuestionsController } from './questions/questions.controller';
import { AnswersController } from './answers/answers.controller';

@Module({
  controllers: [QuestionsController, AnswersController],
  providers: [QuestionsService, AnswersService],
  exports: [QuestionsService],
})
export class QnaModule {}
