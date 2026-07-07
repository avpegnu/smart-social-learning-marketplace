# 03 — Mail & Uploads Modules: Gmail SMTP (Nodemailer) & Cloudinary Media

> Giải thích MailService (Gmail SMTP via Nodemailer), UploadsService (Cloudinary media),
> Global vs non-Global modules, và signed upload pattern.

---

## 1. MAIL MODULE — GMAIL SMTP (NODEMAILER)

### 1.1 Nodemailer là gì?

**Nodemailer** là thư viện Node.js phổ biến nhất để gửi email — hỗ trợ SMTP, và nhiều transport khác. SSLM dùng Nodemailer kết hợp **Gmail SMTP** để gửi transactional emails (verification, reset password, order receipt). So sánh:

| Solution                    | Free Tier                     | Ưu điểm                                                    | Nhược điểm               |
| --------------------------- | ----------------------------- | ---------------------------------------------------------- | ------------------------ |
| **Gmail SMTP + Nodemailer** | 500 emails/ngày               | Miễn phí, không cần đăng ký service, App Password đơn giản | Giới hạn 500/ngày        |
| Resend                      | 100 emails/ngày               | API đơn giản, React Email support                          | Cần đăng ký, giới hạn ít |
| SendGrid                    | 100 emails/ngày               | Phổ biến, nhiều features                                   | Setup phức tạp           |
| Mailgun                     | 5,000 emails/tháng (3 months) | Generous free tier                                         | Hết 3 tháng phải trả     |

SSLM chọn **Gmail SMTP + Nodemailer** vì: Miễn phí hoàn toàn, không cần đăng ký third-party service, 500 emails/ngày đủ cho graduation thesis, setup đơn giản với Gmail App Password.

### 1.2 Transactional Email vs Marketing Email

```
Transactional Email (Gmail SMTP):
  ├── Trigger: User action (register, buy, reset password)
  ├── Content: Cá nhân hóa cho 1 user
  ├── Timing: Gửi ngay lập tức
  └── Ví dụ: "Verify your email", "Order #123 confirmed"

Marketing Email (Mailchimp, etc.):
  ├── Trigger: Campaign schedule
  ├── Content: Giống nhau cho nhiều users
  ├── Timing: Theo lịch
  └── Ví dụ: "New courses this week!", "Sale 50% off"

SSLM chỉ dùng Transactional Email.
```

### 1.3 File `mail.service.ts` — Phân tích chi tiết

```typescript
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter;
  private fromEmail: string;

  constructor(@Inject(ConfigService) private readonly configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('mail.smtpHost'),
      port: this.configService.get<number>('mail.smtpPort'),
      secure: false,
      auth: {
        user: this.configService.get<string>('mail.smtpUser'),
        pass: this.configService.get<string>('mail.smtpPass'),
      },
    });
    this.fromEmail = this.configService.get<string>('mail.fromEmail') || this.configService.get<string>('mail.smtpUser') || 'noreply@sslm.com';
  }
```

**Nodemailer transporter** — tạo 1 lần trong constructor, reuse cho mọi email:

- `nodemailer.createTransport(options)` — khởi tạo SMTP connection với Gmail
- `host: 'smtp.gmail.com'` + `port: 587` — Gmail SMTP server (STARTTLS)
- `auth.user` — Gmail address, `auth.pass` — Gmail App Password (không phải mật khẩu Gmail thường)
- `fromEmail` — sender address hiển thị cho người nhận

### 1.4 Generic `sendEmail()` method

```typescript
async sendEmail({ to, subject, html }: SendEmailOptions) {
  const info = await this.transporter.sendMail({
    from: `SSLM <${this.fromEmail}>`,  // "SSLM <your@gmail.com>"
    to,
    subject,
    html,
  });
  this.logger.log(`Email sent to ${to}, messageId: ${info.messageId}`);
  return info;
}
```

**`from` format:** `"Display Name <email>"` — người nhận thấy "SSLM" thay vì raw email address.

### 1.5 Email Templates trong SSLM

**Verification Email** — gửi khi user đăng ký:

```typescript
async sendVerificationEmail(to: string, token: string) {
  const verifyUrl = `${this.configService.get('app.studentPortalUrl')}/auth/verify-email?token=${token}`;
  return this.sendEmail({
    to,
    subject: 'Verify your email — SSLM',
    html: `
      <h2>Welcome to Smart Social Learning Marketplace!</h2>
      <p>Click the link below to verify your email:</p>
      <a href="${verifyUrl}">${verifyUrl}</a>
      <p>This link expires in 24 hours.</p>
    `,
  });
}
```

**Flow:**

```
1. User POST /api/auth/register
2. Backend tạo user + verificationToken (random string)
3. MailService.sendVerificationEmail(user.email, token)
4. User nhận email, click link
5. Frontend gọi POST /api/auth/verify-email?token=abc123
6. Backend verify token → user.status = ACTIVE
```

**Reset Password Email** — gửi khi user quên mật khẩu:

```typescript
async sendResetPasswordEmail(to: string, token: string) {
  const resetUrl = `${this.configService.get('app.studentPortalUrl')}/auth/reset-password?token=${token}`;
  // ...
}
```

**Order Receipt Email** — gửi khi mua khóa học thành công:

```typescript
async sendOrderReceiptEmail(to: string, orderId: string, totalAmount: number) {
  // totalAmount.toLocaleString('vi-VN') → "150.000" (format VNĐ)
  // ...
}
```

### 1.6 Tại sao `configService.get('app.studentPortalUrl')` ở đây?

Email chứa link cho user click → link phải trỏ đến **frontend** (student portal), không phải backend API. Ví dụ:

```
✅ Correct: https://sslm.com/auth/verify-email?token=abc
                    ^^^^^^^^ student portal URL

❌ Wrong: https://api.sslm.com/auth/verify-email?token=abc
                  ^^^^^^^^^^^^^ backend URL — user không truy cập trực tiếp
```

### 1.7 Mail Module — Global

```typescript
@Global()
@Module({
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
```

`@Global()` vì MailService dùng ở nhiều modules: Auth (verification, reset password), Orders (receipt), Notifications (alerts).

---

## 2. UPLOADS MODULE — CLOUDINARY

### 2.1 Cloudinary là gì?

**Cloudinary** là media management platform — upload, store, transform, deliver images & videos.

```
Upload flow trong SSLM:
  ┌──────────┐         ┌──────────────┐         ┌───────────┐
  │  Browser  │ ──(1)── │  Backend API │ ──(2)── │ Cloudinary │
  │ (Student) │         │  (NestJS)    │         │  (Cloud)   │
  └──────────┘         └──────────────┘         └───────────┘
       │                       │                       │
       │  (1) Xin signed       │                       │
       │      upload params    │                       │
       │ ───────────────────>  │                       │
       │                       │                       │
       │  (2) Trả về signature │                       │
       │ <───────────────────  │                       │
       │                       │                       │
       │  (3) Upload trực tiếp đến Cloudinary          │
       │ ─────────────────────────────────────────────> │
       │                       │                       │
       │  (4) Cloudinary trả về URL                    │
       │ <───────────────────────────────────────────── │
       │                       │                       │
       │  (5) Gửi URL về backend để lưu DB             │
       │ ───────────────────>  │                       │
```

### 2.2 Signed Upload — Tại sao?

```
❌ Unsigned Upload:
   Browser upload trực tiếp → ai cũng upload được
   Không kiểm soát ai upload, upload gì

✅ Signed Upload:
   Browser xin signature từ backend (phải authenticated)
   → Backend ký bằng API Secret
   → Browser upload với signature
   → Cloudinary verify signature → OK → accept upload

   Chỉ authenticated users mới upload được
   Backend kiểm soát folder, file size limits
```

### 2.3 File `uploads.service.ts` — Phân tích

```typescript
@Injectable()
export class UploadsService {
  constructor(@Inject(ConfigService) private readonly configService: ConfigService) {
    cloudinary.config({
      cloud_name: this.configService.get('cloudinary.cloudName'),
      api_key: this.configService.get('cloudinary.apiKey'),
      api_secret: this.configService.get('cloudinary.apiSecret'),
    });
  }
```

**`cloudinary.config()`** — Configure Cloudinary SDK globally. Gọi 1 lần trong constructor.

### 2.4 `generateSignedUploadParams()`

```typescript
async generateSignedUploadParams(folder: string) {
  const timestamp = Math.round(Date.now() / 1000);  // Unix timestamp (giây)
  const signature = cloudinary.utils.api_sign_request(
    { timestamp, folder },
    this.configService.get('cloudinary.apiSecret') || '',
  );

  return {
    timestamp,      // Khi nào ký
    signature,      // Chữ ký
    folder,         // Upload vào folder nào (courses/, avatars/, ...)
    cloudName,      // Cloudinary account
    apiKey,         // Public API key (không phải secret)
  };
}
```

**Signature giải thích:**

```
api_sign_request({ timestamp, folder }, apiSecret):
  1. Sắp xếp params theo alphabet: "folder=courses&timestamp=1710000000"
  2. Nối API Secret vào cuối: "folder=courses&timestamp=1710000000SECRET_KEY"
  3. Hash SHA-1: "a1b2c3d4e5..."
  4. Đó là signature

Cloudinary verify:
  1. Nhận upload request với signature
  2. Tự tính lại signature từ params + secret (Cloudinary biết secret)
  3. So sánh → khớp → OK, accept upload
  4. Không khớp → reject (ai đó giả mạo request)
```

**Folder structure trên Cloudinary:**

```
sslm/
├── courses/         → Course thumbnails, intro videos
│   ├── course-abc/
│   │   ├── thumbnail.jpg
│   │   └── intro-video.mp4
├── avatars/         → User profile pictures
├── posts/           → Social media post images
└── certificates/    → Certificate template images
```

### 2.5 `deleteFile()` — Xóa media

```typescript
async deleteFile(publicId: string): Promise<void> {
  await cloudinary.uploader.destroy(publicId);
}
```

**Public ID** là identifier duy nhất trên Cloudinary:

```
URL:       https://res.cloudinary.com/sslm/image/upload/v123/courses/thumbnail.jpg
Public ID: courses/thumbnail
//         ^^^^^^^^^^^^^^^^^^ path relative to upload folder
```

Khi xóa course → xóa media trên Cloudinary để tiết kiệm storage (free tier 25GB).

### 2.6 `getVideoInfo()` — Metadata video

```typescript
async getVideoInfo(publicId: string): Promise<UploadApiResponse> {
  return cloudinary.api.resource(publicId, { resource_type: 'video' });
}
```

Trả về metadata: duration, width, height, format, size. SSLM dùng **duration** để tính progress tracking (student xem bao nhiêu % video).

### 2.7 Uploads Module — KHÔNG Global

```typescript
@Module({
  providers: [UploadsService],
  exports: [UploadsService],
})
export class UploadsModule {}
```

**Không `@Global()`** — chỉ vài modules cần upload (Courses, Users, Social). Modules cần upload sẽ import `UploadsModule` explicitly:

```typescript
@Module({
  imports: [UploadsModule], // Chỉ import khi cần
})
export class CoursesModule {}
```

---

## 3. GLOBAL vs NON-GLOBAL MODULES

### 3.1 Quyết định khi nào dùng @Global()

```
@Global() — Dùng khi:
  ✅ Module được sử dụng ở HẦU HẾT feature modules (>60%)
  ✅ Infrastructure modules (config, database, cache, logging)
  ✅ Cross-cutting concerns (auth, mail)

Không @Global() — Dùng khi:
  ❌ Module chỉ được sử dụng ở MỘT SỐ feature modules (<40%)
  ❌ Feature-specific modules
  ❌ Module có side effects khi khởi tạo (ví dụ: connect external service)
```

### 3.2 SSLM Global Modules

| Module            | Global? | Lý do                                   |
| ----------------- | ------- | --------------------------------------- |
| `AppConfigModule` | ✅      | ConfigService cần ở mọi nơi             |
| `PrismaModule`    | ✅      | Database access cần ở mọi service       |
| `RedisModule`     | ✅      | Cache + rate limit cần ở nhiều modules  |
| `MailModule`      | ✅      | Email cần ở Auth, Orders, Notifications |
| `UploadsModule`   | ❌      | Chỉ Courses, Users, Social cần upload   |

### 3.3 Trade-offs

```
@Global() pros:
  + Không cần import ở mỗi module → ít boilerplate
  + DX tốt hơn cho infrastructure modules

@Global() cons:
  - Implicit dependency — khó biết module phụ thuộc gì
  - Không thể tree-shake — luôn loaded dù không dùng
  - Potential circular dependency nếu dùng quá nhiều
```

---

## 4. TÓM TẮT

```
MailModule (@Global):
  ├── Nodemailer + Gmail SMTP — transactional email service
  ├── 3 email templates: verification, reset password, order receipt
  ├── configService.get('app.studentPortalUrl') cho email links
  └── 500 emails/ngày free tier (Gmail)

UploadsModule (non-Global):
  ├── Cloudinary SDK — media upload & management
  ├── Signed upload pattern — security qua signature
  ├── generateSignedUploadParams() → frontend upload trực tiếp
  ├── deleteFile() → cleanup media khi xóa content
  ├── getVideoInfo() → video duration cho progress tracking
  └── 25GB storage free tier
```
