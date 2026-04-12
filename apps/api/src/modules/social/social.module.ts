import { Module } from '@nestjs/common';
import { JobsModule } from '@/modules/jobs/jobs.module';
import { PostsService } from './posts/posts.service';
import { CommentsService } from './comments/comments.service';
import { InteractionsService } from './interactions/interactions.service';
import { FeedService } from './feed/feed.service';
import { GroupsService } from './groups/groups.service';
import { PostsController } from './posts/posts.controller';
import { FeedController } from './feed/feed.controller';
import { GroupsController } from './groups/groups.controller';

@Module({
  imports: [JobsModule],
  controllers: [PostsController, FeedController, GroupsController],
  providers: [PostsService, CommentsService, InteractionsService, FeedService, GroupsService],
  exports: [PostsService, GroupsService],
})
export class SocialModule {}
