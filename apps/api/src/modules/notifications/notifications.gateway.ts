import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import type { OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Inject } from '@nestjs/common';
import type { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@WebSocketGateway({
  namespace: '/notifications',
  cors: {
    origin: [
      process.env['STUDENT_PORTAL_URL'] || 'http://localhost:3001',
      process.env['MANAGEMENT_PORTAL_URL'] || 'http://localhost:3002',
    ],
  },
})
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  constructor(
    @Inject(JwtService) private readonly jwtService: JwtService,
    @Inject(ConfigService) private readonly configService: ConfigService,
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
      client.data.userId = payload.sub;
      client.join(`user_${payload.sub as string}`);
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(_client: Socket) {
    // No cleanup needed for notifications
  }

  pushToUser(userId: string, notification: Record<string, unknown>) {
    this.server.to(`user_${userId}`).emit('notification', notification);
  }

  pushUnreadCount(userId: string, count: number) {
    this.server.to(`user_${userId}`).emit('unread_count', { count });
  }

  pushOrderStatus(userId: string, orderId: string, status: string) {
    this.server.to(`user_${userId}`).emit('order_status_changed', { orderId, status });
  }
}
