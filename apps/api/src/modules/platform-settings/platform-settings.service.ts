import { Injectable, Inject, Logger, type OnModuleInit } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class PlatformSettingsService implements OnModuleInit {
  private readonly logger = new Logger(PlatformSettingsService.name);
  private cache = new Map<string, unknown>();

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.reload();
  }

  async reload() {
    try {
      const settings = await this.prisma.platformSetting.findMany();
      this.cache.clear();
      for (const s of settings) {
        this.cache.set(s.key, s.value);
      }
      this.logger.log(`Loaded ${settings.length} platform settings`);
    } catch (err) {
      this.logger.warn(`Failed to load platform settings: ${(err as Error).message}`);
    }
  }

  get<T>(key: string, fallback: T): T {
    const value = this.cache.get(key);
    if (value === undefined || value === null) return fallback;
    return value as T;
  }
}
