import { type CanActivate, Inject, Injectable, type ExecutionContext } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import type { Socket } from 'socket.io';
import type { JwtPayload } from '../interfaces/jwt-payload.interface';

@Injectable()
export class WsAuthGuard implements CanActivate {
  constructor(
    @Inject(JwtService) private readonly jwtService: JwtService,
    @Inject(ConfigService) private readonly configService: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const client: Socket = context.switchToWs().getClient();
    const token = client.handshake.auth?.token || client.handshake.query?.token;

    if (!token) return false;

    try {
      const payload = this.jwtService.verify<JwtPayload>(token as string, {
        secret: this.configService.get('auth.jwtAccessSecret'),
      });
      client.data.userId = payload.sub;
      client.data.role = payload.role;
      return true;
    } catch {
      return false;
    }
  }
}
