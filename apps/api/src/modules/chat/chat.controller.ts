import { Body, Controller, Get, Inject, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { CurrentUser } from '@/common/decorators';
import type { JwtPayload } from '@/common/interfaces/jwt-payload.interface';
import { ParseCuidPipe } from '@/common/pipes/parse-cuid.pipe';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PaginationDto } from '@/common/dto/pagination.dto';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CreateConversationDto } from './dto/create-conversation.dto';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { SendMessageDto } from './dto/send-message.dto';

@Controller('conversations')
@ApiTags('Chat')
@ApiBearerAuth()
export class ChatController {
  constructor(@Inject(ChatService) private readonly chatService: ChatService) {}

  @Get()
  @ApiOperation({ summary: 'List conversations' })
  async getConversations(@CurrentUser() user: JwtPayload) {
    return this.chatService.getConversations(user.sub);
  }

  @Post()
  @ApiOperation({ summary: 'Get or create conversation' })
  async getOrCreateConversation(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateConversationDto,
  ) {
    return this.chatService.getOrCreateConversation(user.sub, dto);
  }

  @Get(':id/messages')
  @ApiOperation({ summary: 'Get messages' })
  async getMessages(
    @Param('id', ParseCuidPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Query() query: PaginationDto,
  ) {
    return this.chatService.getMessages(id, user.sub, query);
  }

  @Post(':id/messages')
  @ApiOperation({ summary: 'Send message (REST fallback)' })
  async sendMessage(
    @Param('id', ParseCuidPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: SendMessageDto,
  ) {
    return this.chatService.sendMessage(user.sub, id, dto);
  }
}
