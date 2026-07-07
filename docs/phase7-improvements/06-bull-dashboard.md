# Phase 7.7 — Bull Dashboard: Giám sát Job Queues

> Tích hợp bull-board dashboard vào NestJS API để dev giám sát trạng thái
> các BullMQ queues (email, notification, feed) qua giao diện web.
> Dashboard được bảo vệ bằng HTTP Basic Auth.

---

## 1. Tổng quan

### Vấn đề hiện tại

- 3 BullMQ queues (`email`, `notification`, `feed`) đang chạy nhưng **không có UI** để giám sát
- Khi job fail (ví dụ: gửi email lỗi, feed fanout timeout) → chỉ biết qua PM2 logs
- Không có cách retry job thất bại ngoài việc trigger lại từ đầu
- Không biết queue có bị backlog (tồn đọng) hay không

### Giải pháp

Tích hợp `@bull-board` — thư viện UI dashboard cho BullMQ:

```
Dev truy cập /api/admin/queues
  → Express middleware check Basic Auth (username/password)
  → bull-board serve UI (React app built-in)
  → UI hiển thị: waiting / active / completed / failed / delayed jobs
  → Dev có thể: xem payload, retry failed, clean old jobs
```

### Tổng quan thay đổi

| Scope | File | Thay đổi | Risk |
|-------|------|----------|------|
| Backend | `package.json` | Thêm 3 packages | Thấp |
| Backend | `bull-board.module.ts` | Module mới, đăng ký queues | Thấp |
| Backend | `main.ts` | Thêm Basic Auth middleware cho `/api/admin/queues` | Thấp |
| Backend | `app.module.ts` | Import BullBoardModule + fix BullMQ connection + job retention | Thấp |

---

## 2. Cài đặt packages

```bash
cd apps/api
npm install @bull-board/api @bull-board/express @bull-board/nestjs
```

| Package | Vai trò |
|---------|---------|
| `@bull-board/api` | Core logic: đăng ký queues, expose API cho UI |
| `@bull-board/express` | Express adapter: mount bull-board UI vào Express app |
| `@bull-board/nestjs` | NestJS integration: `forRoot()` + `forFeature()` |

---

## 3. Backend Implementation

### 3a. BullBoardModule

**File mới:** `apps/api/src/modules/bull-board/bull-board.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { BullBoardModule as NestBullBoard } from '@bull-board/nestjs';
import { ExpressAdapter } from '@bull-board/express';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';

@Module({
  imports: [
    NestBullBoard.forRoot({
      route: '/admin/queues',
      adapter: ExpressAdapter,
    }),
    NestBullBoard.forFeature({ name: 'email', adapter: BullMQAdapter }),
    NestBullBoard.forFeature({ name: 'notification', adapter: BullMQAdapter }),
    NestBullBoard.forFeature({ name: 'feed', adapter: BullMQAdapter }),
  ],
})
export class BullBoardModule {}
```

**Giải thích:**

- `NestBullBoard.forRoot()` — khởi tạo bull-board với route prefix `/admin/queues` và Express adapter
- `NestBullBoard.forFeature()` — đăng ký từng queue. `name` phải khớp với tên trong `BullModule.registerQueue()` ở `jobs.module.ts`
- `BullMQAdapter` (không phải `BullAdapter`) — vì project dùng `@nestjs/bullmq` + `bullmq`

### 3b. Basic Auth Middleware

**File:** `apps/api/src/main.ts` — thêm Express-level middleware

```typescript
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
```

**Tại sao dùng Express middleware trong `main.ts` thay vì NestJS middleware?**

Bull-board mount một Express sub-app tại `/admin/queues`. NestJS middleware (`consumer.apply().forRoutes()`) chỉ hoạt động trên routes được NestJS controllers quản lý — bull-board routes nằm ngoài NestJS routing nên **bypass hoàn toàn NestJS middleware pipeline**. Phải apply ở Express level qua `app.use()` trong `main.ts`.

**Tại sao path là `/api/admin/queues` thay vì `/admin/queues`?**

`app.setGlobalPrefix('api')` thêm prefix cho NestJS routes. `app.use()` match theo URL thật mà browser gửi lên — URL thật là `/api/admin/queues`.

**Credentials mặc định:** `admin` / `admin`. Custom qua env vars `BULL_BOARD_USER` và `BULL_BOARD_PASS`.

### 3c. Import BullBoardModule vào AppModule

**File:** `apps/api/src/app.module.ts`

```typescript
import { BullBoardModule } from './modules/bull-board/bull-board.module';

// Trong @Module.imports, thêm SAU BullModule.forRootAsync:
BullBoardModule,
```

### 3d. Fix BullMQ connection + Job retention

**File:** `apps/api/src/app.module.ts` — trong `BullModule.forRootAsync` config:

```typescript
BullModule.forRootAsync({
  inject: [ConfigService],
  useFactory: (config: ConfigService) => {
    const url = config.get<string>('redis.url', 'redis://localhost:6379');
    const parsed = new URL(url);
    return {
      connection: {
        host: parsed.hostname,
        port: parseInt(parsed.port || '6379', 10),
        ...(parsed.password && { password: parsed.password }),
        maxRetriesPerRequest: null,   // BullMQ bắt buộc — fix MaxRetriesPerRequestError
        enableReadyCheck: false,      // Tránh crash khi Redis restart
      },
      defaultJobOptions: {
        removeOnComplete: { age: 86400, count: 200 },  // Giữ 200 jobs hoặc 24h
        removeOnFail: { age: 604800, count: 500 },     // Giữ 500 jobs hoặc 7 ngày
      },
    };
  },
}),
```

**Giải thích:**
- `maxRetriesPerRequest: null` — BullMQ **bắt buộc** phải set `null`, nếu không worker crash với `MaxRetriesPerRequestError` khi Redis ngắt kết nối tạm thời
- `enableReadyCheck: false` — tránh crash khi Redis chưa ready sau restart
- `defaultJobOptions.removeOnComplete/removeOnFail` — tự động dọn old jobs, tránh Redis hết memory

---

## 4. Cấu trúc thư mục

```
apps/api/src/
├── main.ts                              # Basic Auth middleware cho /api/admin/queues
├── app.module.ts                        # Import BullBoardModule
└── modules/
    ├── bull-board/
    │   └── bull-board.module.ts          # Đăng ký 3 queues với bull-board
    └── jobs/
        ├── jobs.module.ts               # Không thay đổi
        └── processors/                  # Không thay đổi
```

---

## 5. Truy cập Dashboard

- **Local:** `http://localhost:3000/api/admin/queues`
- **Production:** `https://api.avpegnu.io.vn/api/admin/queues`

Browser hiện popup Basic Auth → nhập credentials → vào dashboard.

**Credentials mặc định:** `admin` / `admin`

**Custom:** thêm vào `.env`:
```
BULL_BOARD_USER=myuser
BULL_BOARD_PASS=mypassword
```

---

## 6. Dashboard UI — Tính năng có sẵn

| Tính năng | Mô tả |
|-----------|-------|
| **Queue overview** | Số jobs theo status: waiting, active, completed, failed, delayed |
| **Job detail** | Xem payload (data), return value, error stack trace, timestamps |
| **Retry failed** | Click retry trên từng failed job hoặc retry all |
| **Clean jobs** | Xóa completed/failed jobs cũ (giải phóng Redis memory) |
| **Pause/Resume** | Tạm dừng hoặc tiếp tục xử lý queue |
| **Search** | Tìm job theo ID |
| **Auto-refresh** | UI tự cập nhật mỗi vài giây |

---

## 7. Thứ tự implement

```
1. Cài packages:
   cd apps/api && npm install @bull-board/api @bull-board/express @bull-board/nestjs

2. Tạo apps/api/src/modules/bull-board/bull-board.module.ts

3. Thêm Basic Auth middleware vào apps/api/src/main.ts (app.use trước setGlobalPrefix)

4. Cập nhật apps/api/src/app.module.ts:
   a. Import BullBoardModule (sau BullModule.forRootAsync)
   b. Thêm maxRetriesPerRequest: null + enableReadyCheck: false vào connection
   c. Thêm defaultJobOptions cho job retention

5. Verify:
   a. npx tsc --noEmit
   b. npm run start:dev
   c. Mở incognito → http://localhost:3000/api/admin/queues → popup login
   d. Nhập admin/admin → thấy 3 queues
   e. Trigger action (forgot password, etc.) → xem job xuất hiện
```

---

## 8. Checklist

- [x] `npm install @bull-board/api @bull-board/express @bull-board/nestjs`
- [x] `bull-board.module.ts` — forRoot + 3x forFeature (email, notification, feed)
- [x] `main.ts` — Express-level Basic Auth middleware cho `/api/admin/queues`
- [x] `app.module.ts` — import BullBoardModule sau BullModule.forRootAsync
- [x] `app.module.ts` — `maxRetriesPerRequest: null` + `enableReadyCheck: false`
- [x] `app.module.ts` — `defaultJobOptions` removeOnComplete + removeOnFail
- [x] TypeScript clean
- [x] Dashboard accessible tại `/api/admin/queues` với Basic Auth
- [x] 3 queues hiển thị: email, notification, feed

---

## 9. Commit

```
feat(api): add bull-board dashboard with basic auth for job queue monitoring
```
