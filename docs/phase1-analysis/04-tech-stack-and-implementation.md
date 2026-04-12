# 4. TECH STACK & IMPLEMENTATION (Free Tier)

## 4.1 Tổng quan: Tất cả đều FREE

```
┌─────────────────────────────────────────────────────────────────────┐
│                        FREE TIER STACK                              │
│                                                                     │
│  FRONTEND (2 apps)          BACKEND              DATABASE           │
│  ┌──────────────────┐      ┌──────────────┐     ┌──────────────┐   │
│  │ Vercel (free)    │      │ Render.com   │     │ Neon.tech    │   │
│  │                  │      │ (free)       │     │ (free)       │   │
│  │ Student Portal   │      │              │     │              │   │
│  │ + Management     │ ───► │ Node.js /    │ ──► │ PostgreSQL   │   │
│  │   Portal         │      │ NestJS       │     │ 0.5GB        │   │
│  │                  │      │              │     │              │   │
│  │ Next.js          │      │ 750h/month   │     │ Branching    │   │
│  │ (2 projects)     │      │ auto-sleep   │     │ pgvector ext │   │
│  └──────────────────┘      │ 512MB RAM    │     └──────────────┘   │
│                            └──────┬───────┘                         │
│                                   │                                 │
│         ┌─────────────┬───────────┼───────────┬──────────────┐      │
│         ▼             ▼           ▼           ▼              ▼      │
│  ┌────────────┐ ┌──────────┐ ┌─────────┐ ┌────────┐ ┌───────────┐ │
│  │ Cloudinary │ │ Upstash  │ │ Groq    │ │ SePay  │ │ Gmail SMTP│ │
│  │ (free)     │ │ (free)   │ │ (free)  │ │ (free) │ │ (free)    │ │
│  │            │ │          │ │         │ │        │ │           │ │
│  │ Media:     │ │ Redis:   │ │ AI:     │ │ Payment│ │ Email:    │ │
│  │ 25GB store │ │ 10K cmd/ │ │ Llama3  │ │ QR bank│ │ 500/day   │ │
│  │ Video+Img  │ │ day      │ │ 70B     │ │transfer│ │           │ │
│  │ Transform  │ │ 256MB    │ │ 30 req/ │ │ Webhook│ │           │ │
│  │ CDN auto   │ │          │ │ min     │ │ Free   │ │           │ │
│  └────────────┘ └──────────┘ └─────────┘ └────────┘ └───────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 4.2 Chi tiết từng service

### Frontend: Vercel (Free)

```
Plan:           Hobby (free)
Bandwidth:      100GB/month
Builds:         Unlimited
Projects:       Unlimited
Serverless:     100GB-hours/month

Cách dùng:
  - 2 projects: student-portal + management-portal
  - Cả hai dùng Next.js (SSR + SSG)
  - Auto deploy từ GitHub
  - Custom domain: free (student.domain.com, manage.domain.com)

Giới hạn:
  - Serverless function timeout: 10 giây (Hobby)
  - 1 team member only
```

### Backend: Render.com (Free)

```
Plan:           Free
RAM:            512MB
CPU:            Shared
Bandwidth:      100GB/month
Build minutes:  500/month

Cách dùng:
  - 1 Web Service: NestJS backend (REST API + WebSocket)
  - Auto deploy từ GitHub

Giới hạn:
  - AUTO-SLEEP sau 15 phút không có request
    → Giải pháp: Cron ping mỗi 14 phút (cron-job.org free)
  - 750 giờ/tháng (đủ chạy 24/7 cho 1 service)

Alternative: Railway ($5 free credit/month, không auto-sleep)
```

### Database: Neon.tech (Free PostgreSQL)

```
Plan:           Free
Storage:        0.5GB (512MB)
Compute:        0.25 vCPU, 1GB RAM
Branches:       10 (dev/staging/prod)
Extensions:     pgvector (dùng cho RAG)

Cách dùng:
  - Main database cho toàn bộ app
  - pgvector extension cho AI Tutor (embedding search)

Giới hạn:
  - 0.5GB → Video/image KHÔNG lưu DB (lưu Cloudinary URL)
  - Auto-suspend sau 5 phút idle → reconnect 1-3 giây
  - Estimated: 0.5GB đủ cho ~10K users, ~1K courses

Alternative: Supabase (500MB free, có built-in Auth, Realtime)
```

### Cache/Queue: Upstash Redis (Free)

```
Plan:           Free
Commands:       10,000/day
Storage:        256MB
Regions:        Global

Cách dùng:
  - Cache API responses
  - Rate limiting counters
  - Session management
```

### Media Storage: Cloudinary (Free)

```
Plan:           Free
Storage:        25GB
Bandwidth:      25GB/month
Transformations: 25K/month
Video:          Upload + transcode + streaming + CDN

Cách dùng:
  - Upload video bài giảng (direct từ client)
  - Upload images (avatar, thumbnail, post images)
  - Auto-transcode video (eager transforms)
  - CDN delivery (tự động, toàn cầu)
  - Image optimization (auto format, resize)
```

### AI: Groq API (Free)

```
Plan:           Free
Models:         Llama 3.3 70B, Mixtral 8x7B, Gemma 2...
Rate limit:     30 requests/minute, 14,400/day
Speed:          ~500 tokens/giây (nhanh hơn OpenAI 10x)
Context:        128K tokens (Llama 3.3)

Cách dùng:
  - AI Tutor (RAG): local embeddings + pgvector search + Groq generate

Embedding (cho RAG):
  - Transformers.js local: all-MiniLM-L6-v2 (~80MB, free, no API)
```

### Payment: SePay (Free)

```
Plan:           Free (100% miễn phí)
Cách hoạt động: QR Bank Transfer + Webhook auto-confirm
Ngân hàng:      Hỗ trợ tất cả ngân hàng VN
Phí:            0đ (chuyển khoản ngân hàng = free)
API:            REST API + Webhook
```

### Email: Gmail SMTP (Free)

```
Plan:           Free
Emails:         500/day
Setup:          Gmail account + App Password
Library:        Nodemailer

Chỉ gửi email cho events QUAN TRỌNG:
  - Xác nhận đăng ký, Reset password
  - Thanh toán thành công
  - Instructor/Course approved/rejected
  - Withdrawal completed
  → Estimate: 20-50 emails/day (đủ cho đồ án)
```

---

## 4.3 Chi phí tổng: 0đ/tháng

```
┌────────────────────┬──────────┬─────────────────────────┐
│ Service            │ Cost     │ Free Tier Limit          │
├────────────────────┼──────────┼─────────────────────────┤
│ Vercel (FE × 2)   │ $0       │ 100GB bandwidth          │
│ Render.com (BE)    │ $0       │ 750h, auto-sleep         │
│ Neon.tech (DB)     │ $0       │ 0.5GB storage            │
│ Upstash (Redis)    │ $0       │ 10K cmd/day              │
│ Cloudinary (Media) │ $0       │ 25GB storage, 25GB BW    │
│ Groq (AI)          │ $0       │ 30 req/min               │
│ SePay (Payment)    │ $0       │ Unlimited                │
│ Gmail SMTP (Email) │ $0       │ 500/day                  │
│ GitHub (Code)      │ $0       │ Unlimited                │
│ cron-job.org       │ $0       │ Keep-alive pings         │
├────────────────────┼──────────┼─────────────────────────┤
│ TOTAL              │ $0/month │                          │
└────────────────────┴──────────┴─────────────────────────┘

Domain name: ~200K VNĐ/năm (optional, có thể dùng .vercel.app free)
```

---

## 4.4 Recommended Tech Stack chi tiết

```
FRONTEND:
  Framework:    Next.js 14 (App Router)
  Language:     TypeScript
  UI Library:   Shadcn/ui (free, beautiful) + Tailwind CSS
  State:        Zustand (lightweight) hoặc React Context
  Forms:        React Hook Form + Zod validation
  Rich Editor:  Tiptap (free, extensible)
  Video Player: Video.js hoặc Plyr
  Charts:       Recharts (free)
  Realtime:     Socket.io-client
  HTTP:         Axios hoặc fetch + React Query (TanStack Query)

BACKEND:
  Runtime:      Node.js 20 LTS
  Framework:    NestJS (TypeScript, modular, production-ready)
  ORM:          Prisma (type-safe, great DX)
  Auth:         Passport.js + JWT (jsonwebtoken)
  Validation:   class-validator + class-transformer (NestJS built-in)
  File Upload:  Cloudinary SDK (@cloudinary/node)
  WebSocket:    Socket.io (NestJS gateway)
  AI:           Groq SDK (groq-sdk)
  Embedding:    Transformers.js (@xenova/transformers)
  Email:        Nodemailer (nodemailer)
  Payment:      SePay webhook (custom implementation)
  Queue:        Bull (với Upstash Redis) hoặc in-process queue
  Cron:         @nestjs/schedule
  API Docs:     Swagger (@nestjs/swagger — auto-generate)
  Testing:      Jest + Supertest

DATABASE:
  Primary:      PostgreSQL 16 (Neon.tech)
  ORM:          Prisma (schema-first, migrations)
  Search:       PostgreSQL Full-Text Search (tsvector + GIN)
  Vector:       pgvector extension (cho RAG embeddings)
  Cache:        Upstash Redis

DEVOPS:
  Hosting FE:   Vercel (2 projects)
  Hosting BE:   Render.com
  CI/CD:        GitHub Actions (free for public repos)
  Monitoring:   Sentry.io (free tier: 5K errors/month)
```

---

## 4.5 Video Upload — Cloudinary Implementation

### Flow: Client → Cloudinary Direct Upload → Auto-transcode

```
Instructor                Frontend              Backend              Cloudinary
    │                       │                     │                      │
    │ 1. Chọn file video    │                     │                      │
    │──────────────────────►│                     │                      │
    │                       │                     │                      │
    │                       │ 2. Request upload    │                      │
    │                       │    signature         │                      │
    │                       │ POST /api/uploads/   │                      │
    │                       │   sign               │                      │
    │                       │ {filename, lessonId} │                      │
    │                       │────────────────────►│                      │
    │                       │                     │ 3. Generate:          │
    │                       │                     │    - signature        │
    │                       │                     │    - timestamp        │
    │                       │                     │    - upload_preset    │
    │                       │                     │    - folder path      │
    │                       │                     │    - eager transforms │
    │                       │                     │      (480p, 720p)     │
    │                       │                     │                      │
    │                       │                     │ 4. CREATE media       │
    │                       │                     │    record             │
    │                       │                     │    status: UPLOADING  │
    │                       │                     │                      │
    │                       │ {signature,          │                      │
    │                       │  timestamp,          │                      │
    │                       │  apiKey,             │                      │
    │                       │  uploadPreset,       │                      │
    │                       │  mediaId}            │                      │
    │                       │◄────────────────────│                      │
    │                       │                     │                      │
    │  [Progress bar]       │ 5. Upload TRỰC TIẾP │                      │
    │◄──────────────────────│    lên Cloudinary   │                      │
    │                       │    (không qua BE!)  │                      │
    │                       │ ════════════════════════════════════════►  │
    │                       │    POST https://     │                      │
    │                       │    api.cloudinary.   │                      │
    │                       │    com/v1_1/         │                      │
    │                       │    {cloud}/video/    │                      │
    │                       │    upload            │                      │
    │                       │                     │                      │
    │  [Upload 100%]        │ 6. Cloudinary trả về│                      │
    │  "Video đang xử lý"  │◄═══════════════════════════════════════   │
    │◄──────────────────────│    {                 │                      │
    │                       │      public_id,      │                      │
    │                       │      secure_url,     │                      │
    │                       │      duration,       │                      │
    │                       │      eager: [        │  ← Auto-transcode!  │
    │                       │        {480p url},   │                      │
    │                       │        {720p url}    │                      │
    │                       │      ]               │                      │
    │                       │    }                 │                      │
    │                       │                     │                      │
    │                       │ 7. Gửi result        │                      │
    │                       │    về backend        │                      │
    │                       │ POST /api/uploads/   │                      │
    │                       │   :mediaId/complete  │                      │
    │                       │ {cloudinaryResult}   │                      │
    │                       │────────────────────►│                      │
    │                       │                     │ 8. UPDATE media:      │
    │                       │                     │    status: READY      │
    │                       │                     │    cloudinary_id      │
    │                       │                     │    urls: {            │
    │                       │                     │      original,       │
    │                       │                     │      480p,           │
    │                       │                     │      720p            │
    │                       │                     │    }                 │
    │                       │                     │    duration: 1845    │
    │  ✅ "Video sẵn sàng!" │                     │                      │
    │◄──────────────────────────────────────────── │                     │
```

### Code Implementation

```javascript
// Backend: Generate upload signature
async signUpload(lessonId: string, userId: string) {
  const lesson = await this.validateLessonOwnership(lessonId, userId);
  const timestamp = Math.round(Date.now() / 1000);
  const folder = `courses/${lesson.courseId}/lessons/${lessonId}`;
  const eager = 'c_scale,w_854,h_480|c_scale,w_1280,h_720';
  const eagerAsync = true;

  const signature = cloudinary.utils.api_sign_request(
    { timestamp, folder, eager, eager_async: eagerAsync },
    CLOUDINARY_API_SECRET
  );

  const media = await this.prisma.media.create({
    data: { lessonId, status: 'UPLOADING', type: 'VIDEO' }
  });

  return { mediaId: media.id, signature, timestamp,
    apiKey: CLOUDINARY_API_KEY, cloudName: CLOUDINARY_CLOUD_NAME, folder, eager, eagerAsync };
}

// Frontend: Upload trực tiếp lên Cloudinary
async function uploadVideo(file, signData, onProgress) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('api_key', signData.apiKey);
  formData.append('timestamp', signData.timestamp);
  formData.append('signature', signData.signature);
  formData.append('folder', signData.folder);
  formData.append('eager', signData.eager);
  formData.append('eager_async', 'true');
  formData.append('resource_type', 'video');

  const response = await axios.post(
    `https://api.cloudinary.com/v1_1/${signData.cloudName}/video/upload`,
    formData,
    { onUploadProgress: (e) => onProgress(Math.round(e.loaded / e.total * 100)) }
  );

  await api.post(`/uploads/${signData.mediaId}/complete`, {
    cloudinaryResult: response.data
  });
}
```

### Video Streaming (Cloudinary adaptive)

```javascript
// Cloudinary URL transformation:
const urls = {
  original: `https://res.cloudinary.com/${cloud}/video/upload/courses/5/video.mp4`,
  hd720: `https://res.cloudinary.com/${cloud}/video/upload/c_scale,w_1280/courses/5/video.mp4`,
  sd480: `https://res.cloudinary.com/${cloud}/video/upload/c_scale,w_854/courses/5/video.mp4`,
};
```

### Instructor thoát giữa chừng?

```
Upload lên Cloudinary = client → Cloudinary trực tiếp:
  - Upload chưa xong mà thoát → Cloudinary tự cancel, không tốn storage
  - Upload xong → Cloudinary trả kết quả ngay (có URL)
  - Eager transforms (480p, 720p) chạy ASYNC trên Cloudinary
    → Instructor không cần chờ transcode
  → Không cần build video processing pipeline riêng!
```

### Giới hạn Cloudinary Free & Cách tối ưu

```
Storage: 25GB → ~50 videos × 500MB
  Tối ưu:
  - Compress video client-side trước upload (target 720p)
  - Upload limit: max 500MB/video, max 30 phút
  - Xóa video gốc sau khi có bản transcode → tiết kiệm ~60%

Bandwidth: 25GB/month → ~500 lượt xem video 720p
  Tối ưu:
  - Default quality: 480p, user chọn 720p
  - Lazy loading: chỉ load video khi click play
  → Đủ cho demo đồ án (50-100 users)
```

---

## 4.6 Thanh toán — SePay Implementation

### SePay hoạt động như thế nào?

```
SePay = Dịch vụ tự động xác nhận giao dịch chuyển khoản ngân hàng

Flow:
1. Đăng ký SePay → liên kết 1 tài khoản ngân hàng
2. Khi ai chuyển tiền vào tài khoản → SePay detect → gọi webhook
3. Backend nhận webhook → parse nội dung CK → match với order → hoàn tất

Ưu điểm:
  - 100% FREE (chuyển khoản NH = 0đ phí)
  - Hỗ trợ tất cả ngân hàng VN
  - Có API tạo QR code (VietQR)
  - Webhook realtime (~10-30 giây sau khi CK)
  - Không cần đăng ký doanh nghiệp
```

### Code Implementation

```javascript
// Backend: Tạo order + QR
async createOrder(userId, items, couponCode) {
  // ... validate, tính giá ...

  const order = await this.prisma.order.create({
    data: {
      userId,
      orderCode: `SSML${String(orderId).padStart(6, '0')}`,
      totalAmount: finalPrice,
      status: 'PENDING',
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    }
  });

  const qrUrl = this.generateVietQR({
    bankId: 'MB',
    accountNo: BANK_ACCOUNT_NUMBER,
    accountName: BANK_ACCOUNT_NAME,
    amount: finalPrice,
    description: order.orderCode
  });

  return { orderId: order.id, orderCode: order.orderCode, qrUrl, ... };
}

// VietQR URL:
function generateVietQR({ bankId, accountNo, accountName, amount, description }) {
  return `https://img.vietqr.io/image/${bankId}-${accountNo}-compact2.png`
    + `?amount=${amount}&addInfo=${encodeURIComponent(description)}`
    + `&accountName=${encodeURIComponent(accountName)}`;
}

// Webhook handler: POST /api/webhooks/sepay
async handleSepayWebhook(body, headers) {
  if (headers['x-api-key'] !== SEPAY_WEBHOOK_SECRET) throw new UnauthorizedException();
  if (body.transferType !== 'in') return;

  const content = body.content.toUpperCase();
  const orderCodeMatch = content.match(/SSML\d{6}/);
  if (!orderCodeMatch) return;

  const order = await this.prisma.order.findUnique({
    where: { orderCode: orderCodeMatch[0], status: 'PENDING' }
  });
  if (!order) return;

  if (body.transferAmount < order.totalAmount) {
    await this.logPaymentMismatch(order.id, body);
    return;
  }

  await this.completeOrder(order.id, {
    paymentRef: body.referenceCode,
    paymentGateway: 'SEPAY',
    paidAmount: body.transferAmount,
    paidAt: new Date(body.transactionDate)
  });
}
```

### SePay Edge Cases

```
1. Nội dung CK sai/thiếu mã order → log "unmatched_payments" → Admin review thủ công
2. Chuyển thiếu tiền → không complete → log warning → notify user
3. Chuyển thừa tiền → complete bình thường → log surplus → Admin refund phần thừa
4. Chuyển 2 lần → order đã COMPLETED → skip (idempotent) → Admin review refund
5. Hết hạn 15 phút → cron: status='EXPIRED' → late payment → Admin xử lý thủ công
6. Webhook delay → frontend polling 3s/15 phút timeout → status tự update khi webhook đến
```

### Rút tiền cho Instructor

```
Vì dùng chuyển khoản NH → Rút tiền = Admin chuyển khoản thủ công

Flow:
1. Instructor request withdrawal (API)
2. Admin approve trên Management Portal
3. Admin chuyển khoản thủ công từ TK nền tảng → TK instructor
4. Admin mark withdrawal = COMPLETED
5. System update balance + notify instructor
→ Đơn giản, phù hợp đồ án
```

---

## 4.7 AI Tutor — Groq + Llama Implementation

### RAG Pipeline (Free)

```
                   ┌─────────────────────────────┐
                   │     RAG PIPELINE (FREE)      │
                   │                              │
  Student asks     │  1. Embed question           │
  "Giải thích      │     (local model)            │
   useEffect?"     │           │                  │
       │           │           ▼                  │
       │           │  2. Search pgvector          │
       │           │     → Top 5 relevant chunks  │
       │           │           │                  │
       │           │           ▼                  │
       │           │  3. Compose prompt           │
       │           │     [system + context +      │
       │           │      question]               │
       │           │           │                  │
       │           │           ▼                  │
       │           │  4. Groq API (Llama 3.3 70B) │
       │           │     → Stream response        │
       │           │     → ~500 tokens/sec        │
       │           │                              │
       └──────────►│  5. Return answer            │
                   │                              │
                   └─────────────────────────────┘
```

### Embedding Solution (Free — Local)

```javascript
import { pipeline } from '@xenova/transformers';

let embedder;

async function initEmbedder() {
  // Load model 1 lần khi server start (~5 giây, 80MB)
  embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
}

async function getEmbedding(text) {
  const result = await embedder(text, { pooling: 'mean', normalize: true });
  return Array.from(result.data); // Vector 384 dimensions
}

// pgvector SQL:
// INSERT INTO course_chunks (lesson_id, content, embedding)
//   VALUES ($1, $2, $3::vector)
// SELECT content, 1 - (embedding <=> $1::vector) AS similarity
//   FROM course_chunks WHERE course_id = $2
//   ORDER BY embedding <=> $1::vector LIMIT 5
```

### Groq API Call

```javascript
import Groq from 'groq-sdk';
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function askAITutor(question, contextChunks, courseTitle) {
  const context = contextChunks.map((c) => c.content).join('\n\n');

  const stream = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      {
        role: 'system',
        content: `Bạn là AI Tutor cho khóa học "${courseTitle}".
Trả lời câu hỏi DỰA TRÊN nội dung khóa học bên dưới.
Nếu câu hỏi ngoài phạm vi → nói rõ "Câu hỏi này nằm ngoài nội dung khóa học".
Trả lời bằng tiếng Việt, dễ hiểu, có ví dụ nếu cần.`,
      },
      {
        role: 'user',
        content: `NỘI DUNG KHÓA HỌC:\n${context}\n\nCÂU HỎI: ${question}`,
      },
    ],
    stream: true,
    max_tokens: 1024,
    temperature: 0.3,
  });

  return stream;
}
```

### Rate Limiting (Groq free)

```
Groq: 30 requests/minute, 14,400/day

Chiến lược:
  - Mỗi user: max 10 câu/ngày
  - Redis counter: INCR ai_usage:{userId}:{date}, EXPIRE 86400
  - Backend queue: max 25 req/min (buffer 5)
  - Nếu queue full → "AI Tutor đang bận, thử lại sau 1 phút"
```

---

## 4.8 Upstash Redis — Tối ưu 10K commands/day

```
Chiến lược tiết kiệm:

1. JWT Refresh Tokens → lưu DB thay Redis (chậm hơn ~5ms, tiết kiệm ~500 cmd/day)

2. Rate Limiting → giữ Redis (cần fast check, ~200 cmd/day)

3. Cache → chỉ cache HOT data:
   - Homepage courses: 1 key, TTL 10 phút (~150 GET/day)
   - Course detail: cache theo courseId, TTL 30 phút (~500 GET/day)
   - Bỏ: feed cache, recommendation cache (tính realtime, acceptable)

4. Socket.io → in-memory adapter (single instance, không cần Redis adapter)

5. Like counts → DB trực tiếp (acceptable cho <1000 concurrent users)

Estimated: ~3,000-5,000 commands/day (trong giới hạn 10K)
```

---

## 4.9 Render.com Auto-Sleep — Giải pháp

```
Problem: Auto-sleep sau 15 phút idle → cold start ~30-50 giây

Solutions:
  1. Keep-alive ping:
     - cron-job.org (free) → GET /api/health mỗi 14 phút
     - Server không bao giờ sleep

  2. Nếu chấp nhận cold start:
     - Loading screen "Đang khởi động server..."
     - Frontend timeout 60 giây cho request đầu

  3. WebSocket reconnect:
     - Socket.io built-in auto-reconnection
```

---

## 4.10 Neon.tech Auto-Suspend — Giải pháp

```
Problem: Suspend compute sau 5 phút idle → reconnect 1-3 giây

Solutions:
  1. Neon connection pooling (built-in, transparent)

  2. Prisma config:
     datasource db {
       provider  = "postgresql"
       url       = env("DATABASE_URL")    // pooled connection
       directUrl = env("DIRECT_URL")      // direct (cho migrations)
     }

  3. Keep-alive: cron ping cũng giữ DB awake
```

---

## 4.11 Tổng kết: Triển khai được không?

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   ✅ CÓ — 100% triển khai được với free tier               │
│                                                             │
│   Giới hạn thực tế:                                        │
│   • ~50-100 concurrent users (đủ cho demo đồ án)           │
│   • ~50 videos (25GB Cloudinary)                           │
│   • ~500 video views/month (25GB bandwidth)                │
│   • Cold start 30-50s (nếu không ping keep-alive)          │
│   • AI Tutor: 10 câu/user/ngày                            │
│                                                             │
│   HOÀN TOÀN ĐỦ cho:                                        │
│   ✅ Demo đồ án tốt nghiệp                                 │
│   ✅ Giám khảo test thử                                    │
│   ✅ Chạy với ~20-50 users thật                            │
│                                                             │
│   Nếu muốn production (sau tốt nghiệp):                   │
│   → Upgrade Render: $7/month (no sleep)                    │
│   → Upgrade Cloudinary: $89/month (1TB)                    │
│   → Upgrade Neon: $19/month (10GB)                         │
│   → Tổng: ~$115/month (~2.8M VNĐ)                         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```
