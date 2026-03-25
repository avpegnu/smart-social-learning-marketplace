import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import type { OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Inject } from '@nestjs/common';
import type { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ChatService } from './chat.service';
import { RedisService } from '@/redis/redis.service';
import type { MessageType } from '@prisma/client';
import { SendMessageDto } from './dto/send-message.dto';

@WebSocketGateway({
  namespace: '/chat',
  cors: {
    origin: [
      process.env['STUDENT_PORTAL_URL'] || 'http://localhost:3001',
      process.env['MANAGEMENT_PORTAL_URL'] || 'http://localhost:3002',
    ],
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  constructor(
    @Inject(ChatService) private readonly chatService: ChatService,
    @Inject(JwtService) private readonly jwtService: JwtService,
    @Inject(ConfigService) private readonly configService: ConfigService,
    @Inject(RedisService) private readonly redis: RedisService,
  ) {}

  async handleConnection(client: Socket) {
    const token = client.handshake.auth?.token || client.handshake.query?.['token'];
    if (!token || typeof token !== 'string') {
      client.disconnect();
      return;
    }
    try {
      const payload = this.jwtService.verify(token, {
        secret: this.configService.getOrThrow<string>('auth.jwtAccessSecret'),
      });
      const userId = payload.sub as string;
      client.data.userId = userId;
      client.join(`user_${userId}`);
      await this.redis.setex(`online:${userId}`, 300, '1');
    } catch {
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    if (client.data.userId) {
      await this.redis.del(`online:${client.data.userId as string}`);
    }
  }

  @SubscribeMessage('join_conversation')
  async handleJoinConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    const userId = client.data.userId as string;
    const canJoin = await this.chatService.isMember(data.conversationId, userId);
    if (!canJoin) return { error: 'NOT_CONVERSATION_MEMBER' };

    client.join(`conv_${data.conversationId}`);
    return { success: true };
  }

  @SubscribeMessage('send_message')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: { conversationId: string; content: string; type?: MessageType },
  ) {
    const userId = client.data.userId as string;

    const dto: SendMessageDto = Object.assign(new SendMessageDto(), {
      content: data.content,
      type: data.type,
    });

    const message = await this.chatService.sendMessage(userId, data.conversationId, dto);

    this.server.to(`conv_${data.conversationId}`).emit('new_message', message);

    // Notify members NOT currently in the conversation room (offline/other pages)
    const members = await this.chatService.getConversationMembers(data.conversationId);
    const roomSockets = await this.server.in(`conv_${data.conversationId}`).fetchSockets();
    const activeUserIds = new Set(roomSockets.map((s) => s.data.userId as string));

    for (const member of members) {
      if (member.userId !== userId && !activeUserIds.has(member.userId)) {
        // User not in room — send notification via their personal room
        this.server.to(`user_${member.userId}`).emit('new_message_notification', {
          conversationId: data.conversationId,
          senderId: userId,
          content: data.content.slice(0, 100),
        });
      }
    }

    return { success: true, messageId: message.id };
  }

  @SubscribeMessage('typing')
  handleTyping(@ConnectedSocket() client: Socket, @MessageBody() data: { conversationId: string }) {
    client.to(`conv_${data.conversationId}`).emit('user_typing', {
      userId: client.data.userId,
      conversationId: data.conversationId,
    });
  }

  @SubscribeMessage('stop_typing')
  handleStopTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    client.to(`conv_${data.conversationId}`).emit('user_stop_typing', {
      userId: client.data.userId,
      conversationId: data.conversationId,
    });
  }

  @SubscribeMessage('mark_read')
  async handleMarkRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    const userId = client.data.userId as string;
    await this.chatService.markRead(data.conversationId, userId);

    // Notify others in the conversation
    client.to(`conv_${data.conversationId}`).emit('message_read', {
      userId,
      conversationId: data.conversationId,
    });

    // Confirm back to sender so their UI updates
    client.emit('mark_read_confirmed', { conversationId: data.conversationId });
  }
}
