import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Cookie parser (for httpOnly refresh token)
  app.use(cookieParser());

  // Basic auth for Bull Dashboard
  const bullUser = process.env.BULL_BOARD_USER || 'admin';
  const bullPass = process.env.BULL_BOARD_PASS || 'admin';
  app.use('/api/admin/queues', (req: unknown, res: unknown, next: () => void) => {
    const request = req as { headers: Record<string, string | undefined> };
    const response = res as {
      setHeader: (k: string, v: string) => void;
      status: (code: number) => { send: (body: string) => void };
    };
    const auth = request.headers.authorization;
    if (auth?.startsWith('Basic ')) {
      const [u, p] = Buffer.from(auth.slice(6), 'base64').toString().split(':');
      if (u === bullUser && p === bullPass) {
        next();
        return;
      }
    }
    response.setHeader('WWW-Authenticate', 'Basic realm="Bull Dashboard"');
    response.status(401).send('Authentication required');
  });

  // Global prefix
  app.setGlobalPrefix('api');

  // CORS
  app.enableCors({
    origin: [
      process.env.STUDENT_PORTAL_URL || 'http://localhost:3001',
      process.env.MANAGEMENT_PORTAL_URL || 'http://localhost:3002',
    ],
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Swagger
  const config = new DocumentBuilder()
    .setTitle('SSLM API')
    .setDescription('Smart Social Learning Marketplace API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.warn(`API running on http://localhost:${port}`);
  console.warn(`Swagger docs: http://localhost:${port}/api/docs`);
}
bootstrap();
