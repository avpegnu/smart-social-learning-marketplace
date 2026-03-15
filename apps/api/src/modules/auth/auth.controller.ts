import {
  Body,
  Controller,
  Get,
  Inject,
  Ip,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { CurrentUser, Public } from '@/common/decorators';
import type { JwtPayload } from '@/common/interfaces/jwt-payload.interface';
// DTOs must be value imports — ValidationPipe needs runtime class reference (emitDecoratorMetadata)
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { RegisterDto } from './dto/register.dto';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { LoginDto } from './dto/login.dto';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { VerifyEmailDto } from './dto/verify-email.dto';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ForgotPasswordDto } from './dto/forgot-password.dto';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ResetPasswordDto } from './dto/reset-password.dto';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ValidateOttDto } from './dto/validate-ott.dto';

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/api/auth',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

@Controller('auth')
@ApiTags('Auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Register a new account' })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Login with email and password' })
  async login(@Body() dto: LoginDto, @Ip() ip: string, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(dto, ip);

    res.cookie('refreshToken', result.refreshToken, REFRESH_COOKIE_OPTIONS);

    return {
      accessToken: result.accessToken,
      user: result.user,
    };
  }

  @Public()
  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token using httpOnly cookie' })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.refreshToken as string | undefined;
    if (!refreshToken) {
      throw new UnauthorizedException({ code: 'MISSING_REFRESH_TOKEN' });
    }

    const result = await this.authService.refresh(refreshToken);

    res.cookie('refreshToken', result.refreshToken, REFRESH_COOKIE_OPTIONS);

    return { accessToken: result.accessToken };
  }

  @ApiBearerAuth()
  @Post('logout')
  @ApiOperation({ summary: 'Logout and invalidate refresh token' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.refreshToken as string | undefined;
    if (refreshToken) {
      await this.authService.logout(refreshToken);
    }

    res.clearCookie('refreshToken', { path: '/api/auth' });
    return { message: 'LOGOUT_SUCCESS' };
  }

  @Public()
  @Post('verify-email')
  @ApiOperation({ summary: 'Verify email with token' })
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto.token);
  }

  @Public()
  @Post('forgot-password')
  @ApiOperation({ summary: 'Send password reset email' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Public()
  @Post('reset-password')
  @ApiOperation({ summary: 'Reset password with token' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @ApiBearerAuth()
  @Get('ott')
  @ApiOperation({ summary: 'Generate one-time token for cross-portal redirect' })
  async generateOtt(@CurrentUser() user: JwtPayload) {
    const ott = await this.authService.generateOtt(user.sub);
    return { ott };
  }

  @Public()
  @Post('ott/validate')
  @ApiOperation({ summary: 'Validate OTT and get tokens' })
  async validateOtt(@Body() dto: ValidateOttDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.validateOtt(dto.ott);

    res.cookie('refreshToken', result.refreshToken, REFRESH_COOKIE_OPTIONS);

    return {
      accessToken: result.accessToken,
      user: result.user,
    };
  }
}
