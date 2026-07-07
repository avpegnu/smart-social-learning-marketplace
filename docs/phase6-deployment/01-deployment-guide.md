# Phase 6 — Hướng dẫn Deploy SSLM lên Production

> Tài liệu giải thích chi tiết từng bước deploy dự án Smart Social Learning Marketplace
> lên Ubuntu Server với domain custom, SSL, và process management.

---

## Mục lục

1. [Tổng quan kiến trúc Production](#1-tổng-quan-kiến-trúc-production)
2. [DNS — Hệ thống phân giải tên miền](#2-dns--hệ-thống-phân-giải-tên-miền)
3. [Server Setup — Cài đặt môi trường](#3-server-setup--cài-đặt-môi-trường)
4. [Database & Services — Dịch vụ bên ngoài](#4-database--services--dịch-vụ-bên-ngoài)
5. [Clone & Configure — Triển khai mã nguồn](#5-clone--configure--triển-khai-mã-nguồn)
6. [Build & Start — Biên dịch và khởi chạy](#6-build--start--biên-dịch-và-khởi-chạy)
7. [Nginx — Reverse Proxy](#7-nginx--reverse-proxy)
8. [SSL — Chứng chỉ bảo mật HTTPS](#8-ssl--chứng-chỉ-bảo-mật-https)
9. [Tổng kết kiến trúc](#9-tổng-kết-kiến-trúc)

---

## 1. Tổng quan kiến trúc Production

### Sơ đồ request flow

```
User (Browser)
    │
    ▼
[DNS] avpegnu.io.vn → 180.93.42.176
    │
    ▼
[Nginx] :443 (HTTPS + SSL)
    │
    ├── avpegnu.io.vn       → proxy_pass localhost:3001 (Student Portal)
    ├── api.avpegnu.io.vn   → proxy_pass localhost:3000 (NestJS API)
    └── manage.avpegnu.io.vn → proxy_pass localhost:3002 (Management Portal)
    │
    ▼
[PM2] Process Manager
    ├── api (port 3000)        — NestJS Backend
    ├── student (port 3001)    — Next.js Student Portal
    └── management (port 3002) — Next.js Management Portal
    │
    ▼
[External Services]
    ├── Neon.tech        — PostgreSQL Database (Singapore)
    ├── Redis            — Cache & Rate Limiting (local hoặc Upstash)
    ├── Cloudinary       — Media Storage (images, videos)
    ├── Groq             — AI LLM API
    └── Gmail SMTP       — Email
```

### Thành phần

| Thành phần | Vai trò | Vị trí |
|------------|---------|--------|
| **Ubuntu Server** | Máy chủ vật lý chạy toàn bộ ứng dụng | VPS Siêu Tốc (180.93.42.176) |
| **Nginx** | Reverse proxy — nhận request từ internet, chuyển tới app đúng | Trên server |
| **PM2** | Process manager — quản lý, giám sát, auto-restart ứng dụng | Trên server |
| **Let's Encrypt** | Cấp chứng chỉ SSL miễn phí cho HTTPS | Tự động qua Certbot |
| **Neon.tech** | PostgreSQL database (managed, free tier) | Cloud — Singapore |
| **Redis** | In-memory cache, rate limiting, session | Trên server (localhost) |
| **Cloudinary** | Lưu trữ và phân phối media (ảnh, video) | Cloud — CDN toàn cầu |

---

## 2. DNS — Hệ thống phân giải tên miền

### DNS là gì?

DNS (Domain Name System) là hệ thống "danh bạ" của Internet. Khi bạn gõ `avpegnu.io.vn` vào trình duyệt, DNS chuyển tên miền đó thành địa chỉ IP (`180.93.42.176`) để trình duyệt biết gửi request tới đâu.

### Bản ghi A Record

**A Record** (Address Record) là loại bản ghi DNS cơ bản nhất — ánh xạ tên miền → địa chỉ IPv4.

```
Tên bản ghi    Loại    Giá trị           TTL
────────────── ─────── ───────────────── ─────
@              A       180.93.42.176     5 phút
api            A       180.93.42.176     5 phút
manage         A       180.93.42.176     5 phút
```

**Giải thích:**
- `@` = domain gốc (`avpegnu.io.vn`) → trỏ về IP server
- `api` = subdomain `api.avpegnu.io.vn` → cùng IP server
- `manage` = subdomain `manage.avpegnu.io.vn` → cùng IP server
- Cả 3 đều trỏ về **cùng 1 server** — Nginx sẽ phân biệt request dựa trên `server_name`

### TTL (Time To Live)

TTL = thời gian DNS resolver (ví dụ Google DNS 8.8.8.8) **cache** kết quả trước khi hỏi lại.

- **5 phút** (300s) — cập nhật nhanh, tốt khi đang setup/thay đổi
- **1 giờ** (3600s) — cân bằng, dùng khi đã ổn định
- **1 ngày** (86400s) — giảm DNS lookup, dùng khi IP không bao giờ đổi

### Kiểm tra DNS

```bash
nslookup avpegnu.io.vn
# Server:         8.8.8.8          ← DNS resolver đang dùng (Google)
# Address:        8.8.8.8#53       ← Port 53 = DNS protocol
# Non-authoritative answer:        ← Kết quả từ cache, không phải DNS gốc
# Name:   avpegnu.io.vn
# Address: 180.93.42.176           ← IP mà domain trỏ tới ✅
```

**"Non-authoritative answer"** = kết quả từ DNS cache (Google 8.8.8.8), không phải từ DNS server gốc của inet. Điều này bình thường.

### Thời gian propagation

Sau khi thêm/sửa DNS record, cần **5-60 phút** (tùy TTL cũ) để các DNS resolver trên thế giới cập nhật. Gọi là "DNS propagation".

---

## 3. Server Setup — Cài đặt môi trường

### 3.1 Cập nhật hệ thống

```bash
sudo apt update && sudo apt upgrade -y
```

- `apt update` — cập nhật danh sách gói phần mềm (biết có gói nào mới)
- `apt upgrade -y` — nâng cấp tất cả gói đã cài lên phiên bản mới nhất
- `-y` — tự động chọn "Yes" cho mọi câu hỏi xác nhận
- `sudo` — chạy với quyền root (admin)

### 3.2 Cài Node.js 22

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
```

**Dòng 1:** Tải script cài đặt NodeSource repository cho Node.js 22.x
- `curl` — công cụ tải file từ URL
- `-fsSL` — flags: fail silently (`f`), show errors (`s`), silent mode (`S`), follow redirects (`L`)
- `|` — pipe: chuyển output của `curl` làm input cho `bash`
- `sudo -E bash -` — chạy script với quyền root, giữ biến môi trường (`-E`)

**Dòng 2:** Cài Node.js từ repository vừa thêm. npm đi kèm Node.js.

**Tại sao Node.js 22?**
- LTS (Long Term Support) — ổn định, được hỗ trợ lâu dài
- Yêu cầu của dự án (CLAUDE.md: Node.js 22 LTS)

### 3.3 Cài Nginx

```bash
sudo apt install -y nginx
```

**Nginx** là web server / reverse proxy. Trong dự án này, Nginx đóng vai trò **reverse proxy** — nhận tất cả request từ internet (port 80/443) rồi chuyển tới ứng dụng Node.js đúng dựa trên domain name.

**Tại sao cần Nginx? Sao không để Node.js nhận request trực tiếp?**
1. **Multiple apps, 1 IP:** Server có 1 IP nhưng 3 apps — Nginx phân biệt request bằng `server_name`
2. **SSL termination:** Nginx xử lý HTTPS, app Node.js chỉ cần HTTP
3. **Security:** Nginx chặn request xấu, DDoS cơ bản trước khi tới app
4. **Static files:** Nginx serve static files nhanh hơn Node.js
5. **Port 80/443:** Chỉ root mới bind port < 1024 — Nginx chạy root, Node.js chạy user thường

### 3.4 Cài Certbot

```bash
sudo apt install -y certbot python3-certbot-nginx
```

**Certbot** — công cụ tự động xin và cài đặt chứng chỉ SSL từ Let's Encrypt.
- `certbot` — core tool
- `python3-certbot-nginx` — plugin để Certbot tự động cấu hình SSL cho Nginx

### 3.5 Cài PM2

```bash
sudo npm install -g pm2
```

**PM2** (Process Manager 2) — quản lý ứng dụng Node.js trên production.
- `-g` — cài global, có thể dùng lệnh `pm2` ở bất kỳ đâu

**PM2 làm gì?**
1. **Daemonize** — chạy app nền, không cần giữ terminal mở
2. **Auto-restart** — app crash → PM2 tự khởi động lại ngay lập tức
3. **Boot startup** — server reboot → PM2 tự start lại tất cả apps
4. **Logging** — ghi log stdout/stderr vào file, xem qua `pm2 logs`
5. **Monitoring** — `pm2 status` xem CPU, RAM, uptime, restart count

### 3.6 Cài Redis

```bash
sudo apt install -y redis-server
```

**Redis** — in-memory data store, dùng cho:
- **Rate limiting** — giới hạn số request/giây (ThrottlerModule)
- **Cache** — cache kết quả query tốn kém
- **Session** — lưu refresh token blacklist
- **Bull queue** — job queue cho background tasks (email, notifications)

Chạy local trên server (localhost:6379) cho performance tốt nhất (< 1ms latency).

---

## 4. Database & Services — Dịch vụ bên ngoài

### 4.1 Neon.tech — PostgreSQL Database

**Neon** là managed PostgreSQL database trên cloud. Free tier: 0.5GB storage.

**Tại sao dùng Neon thay vì cài PostgreSQL trên server?**
- Server VPS thường có ít RAM/disk — database nên tách riêng
- Neon có auto-scaling, backup, branching
- Free tier đủ cho thesis project
- Region Singapore — gần VN, latency thấp (~30ms)

**2 connection strings:**

```
DATABASE_URL=postgresql://user:pass@ep-xxx-pooler.aws.neon.tech/neondb?sslmode=require
DIRECT_URL=postgresql://user:pass@ep-xxx.aws.neon.tech/neondb?sslmode=require
```

- **DATABASE_URL** (pooled) — có `-pooler` trong hostname. Đi qua **connection pooler** (PgBouncer) giúp tái sử dụng connections, tốt cho app runtime.
- **DIRECT_URL** (direct) — kết nối trực tiếp tới database. Dùng cho **migrations** (Prisma migrate) vì migration cần exclusive connection.

**Connection Pooling là gì?**
PostgreSQL có giới hạn số connections đồng thời. Mỗi request mở 1 connection → server lớn hết connection nhanh. Pooler giữ sẵn pool connections và tái sử dụng, giảm overhead.

> ⚠️ **QUAN TRỌNG — Bật pgvector extension trên Neon trước khi migrate**
>
> Dự án có migration `20260323000000_add_pgvector_embedding` chạy `CREATE EXTENSION IF NOT EXISTS vector;` + `ALTER TABLE course_chunks ADD COLUMN embedding vector(384);`. Trên Neon, extension `vector` phải được enable **trước** — nếu chưa bật, `CREATE EXTENSION` fail nhưng `ALTER TABLE ... vector(384)` chạy ngay sau đó cũng fail silently vì type `vector` chưa tồn tại, và Prisma vẫn báo "migration applied". Kết quả: bảng `course_chunks` **thiếu cột `embedding`** → toàn bộ RAG/AI Tutor indexing crash với lỗi:
>
> ```
> Raw query failed. Code: 42703. Message: column "embedding" of relation "course_chunks" does not exist
> ```
>
> **Cách bật pgvector trên Neon (làm MỘT LẦN trước khi chạy `prisma migrate deploy`):**
>
> 1. Vào [Neon Console](https://console.neon.tech) → chọn project
> 2. Sidebar → **SQL Editor**
> 3. Chạy:
>    ```sql
>    CREATE EXTENSION IF NOT EXISTS vector;
>    ```
> 4. Verify:
>    ```sql
>    SELECT * FROM pg_extension WHERE extname = 'vector';
>    ```
>    Phải trả về 1 row.
>
> **Nếu đã lỡ migrate mà cột `embedding` chưa có** — chạy tay trên Neon SQL Editor:
> ```sql
> CREATE EXTENSION IF NOT EXISTS vector;
> ALTER TABLE course_chunks ADD COLUMN IF NOT EXISTS embedding vector(384);
> CREATE INDEX IF NOT EXISTS course_chunks_embedding_idx
>   ON course_chunks USING hnsw (embedding vector_cosine_ops);
> ```
>
> **Lý do Prisma schema không khai báo cột này:** Prisma Client không support type `vector` natively, nên cột được add qua raw SQL migration và truy cập qua `$executeRaw` / `$queryRaw` trong [embeddings.service.ts](../../apps/api/src/modules/ai-tutor/embeddings/embeddings.service.ts). Khi reset DB hoặc tạo Neon project mới, **luôn bật extension trước**.

### 4.2 Upstash hoặc Redis Local

**Option A — Redis local** (khuyên dùng):
```
REDIS_URL=redis://localhost:6379
```
- Latency gần 0 (cùng server)
- Không giới hạn commands/ngày
- Mất data khi server restart (nhưng Redis data là cache, mất không sao)

**Option B — Upstash Redis** (cloud):
```
UPSTASH_REDIS_URL=https://xxx.upstash.io
UPSTASH_REDIS_TOKEN=xxx
```
- Free tier: 10,000 commands/ngày (hạn chế)
- Latency cao hơn (network round trip)
- Dùng REST API thay vì Redis protocol

### 4.3 Các dịch vụ khác

| Dịch vụ | Biến môi trường | Mục đích |
|---------|-----------------|----------|
| **Cloudinary** | `CLOUDINARY_*` | Upload và serve ảnh/video qua CDN |
| **Groq** | `GROQ_API_KEY` | AI Tutor — gọi Llama 3.3 70B model |
| **Gmail SMTP** | `SMTP_*` | Gửi email xác nhận, reset password |
| **SePay** | `SEPAY_*` | Thanh toán QR chuyển khoản ngân hàng |

---

## 5. Clone & Configure — Triển khai mã nguồn

### 5.1 Clone repository

```bash
cd ~/vanh
git clone https://github.com/avpegnu/smart-social-learning-marketplace.git
cd smart-social-learning-marketplace
```

- `git clone` — tải toàn bộ mã nguồn + lịch sử git từ GitHub về server
- Clone vào folder riêng (`~/vanh/`) thay vì home root cho gọn

### 5.2 Tạo file .env — Backend

```bash
nano apps/api/.env
```

File `.env` chứa **biến môi trường** — thông tin nhạy cảm (mật khẩu, API key) KHÔNG được commit lên git. Mỗi môi trường (local, staging, production) có `.env` riêng.

**Các biến quan trọng cho production:**

```env
# URLs — phải đúng domain production
APP_URL=https://api.avpegnu.io.vn
STUDENT_PORTAL_URL=https://avpegnu.io.vn
MANAGEMENT_PORTAL_URL=https://manage.avpegnu.io.vn

# Database — connection strings từ Neon
DATABASE_URL=postgresql://...pooler...
DIRECT_URL=postgresql://...direct...

# Auth — JWT secrets phải khác local, đủ dài (32+ ký tự)
JWT_ACCESS_SECRET=<random string>
JWT_REFRESH_SECRET=<random string khác>
```

**Tại sao JWT secret phải khác local?**
Nếu dùng chung, token tạo ở local có thể dùng trên production → lỗ hổng bảo mật.

### 5.3 Tạo file .env.local — Frontend

```bash
nano apps/student-portal/.env.local
nano apps/management-portal/.env.local
```

```env
NEXT_PUBLIC_API_URL=https://api.avpegnu.io.vn/api
NEXT_PUBLIC_WS_URL=https://api.avpegnu.io.vn
```

- `NEXT_PUBLIC_` prefix — Next.js expose biến này ra browser (client-side)
- Chỉ chứa URL công khai, KHÔNG chứa secrets
- `.env.local` là convention của Next.js — tự động load, nằm trong `.gitignore`

### 5.4 Install dependencies

```bash
npm install
```

- Chạy ở **thư mục gốc** (root monorepo)
- npm workspaces tự cài cho tất cả packages + apps
- Tạo `node_modules/` ở root + symlinks cho từng workspace
- `package-lock.json` đảm bảo version chính xác giống local

### 5.5 Database migration

```bash
cd apps/api
npx prisma generate
npx prisma migrate deploy
```

**`prisma generate`:**
- Đọc `schema.prisma` → sinh Prisma Client (TypeScript code) vào `node_modules/@prisma/client`
- Client này chứa types và methods tương ứng với database schema
- **Phải chạy trước khi build** — nếu không, TypeScript không biết Prisma types

**`prisma migrate deploy`:**
- Đọc các file migration trong `prisma/migrations/`
- Chạy SQL từng migration theo thứ tự trên database production
- Tạo bảng `_prisma_migrations` để track migration nào đã chạy
- Khác với `migrate dev` — `deploy` không tạo migration mới, chỉ apply existing

**Tại sao dùng `deploy` thay vì `dev`?**
- `migrate dev` = development: có thể tạo migration mới, reset data
- `migrate deploy` = production: chỉ apply, không bao giờ xóa data, an toàn

---

## 6. Build & Start — Biên dịch và khởi chạy

### 6.1 Build

```bash
cd ~/vanh/smart-social-learning-marketplace
npm run build
```

Turborepo chạy build song song cho tất cả packages:

| App | Build command | Output | Thời gian |
|-----|---------------|--------|-----------|
| **api** | `nest build` | `dist/` — compiled JavaScript | ~5s |
| **student-portal** | `next build` | `.next/` — optimized production bundle | ~50s |
| **management-portal** | `next build` | `.next/` — optimized production bundle | ~60s |

**NestJS build:** TypeScript → JavaScript (SWC compiler, nhanh hơn tsc)
**Next.js build:** Compile + optimize + tree-shake + code-split + generate static pages

### 6.2 Start với PM2

```bash
# Backend API — port 3000
pm2 start npm --name "api" -- run --workspace=api start:prod

# Student Portal — port 3001
pm2 start npm --name "student" -- run --workspace=student-portal start -- -p 3001

# Management Portal — port 3002
pm2 start npm --name "management" -- run --workspace=management-portal start -- -p 3002
```

**Giải thích cú pháp:**
- `pm2 start npm` — PM2 chạy lệnh `npm` làm process
- `--name "api"` — đặt tên process (hiển thị trong `pm2 status`)
- `--` — phân cách giữa PM2 args và npm args
- `run --workspace=api start:prod` — `npm run --workspace=api start:prod`
- `-p 3001` — port cho Next.js

**Tương đương chạy thủ công:**
```bash
# Không dùng PM2 (terminal bị block, crash = chết):
cd apps/api && npm run start:prod
cd apps/student-portal && npm run start -- -p 3001
cd apps/management-portal && npm run start -- -p 3002

# Dùng PM2 (chạy nền, auto-restart, monitoring):
pm2 start ...
```

### 6.3 PM2 auto-startup

```bash
pm2 save
pm2 startup
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u vanh --hp /home/vanh
```

- `pm2 save` — lưu danh sách processes hiện tại vào file
- `pm2 startup` — tạo systemd service để PM2 tự start khi server boot
- Lệnh `sudo env ...` — PM2 gợi ý, chạy 1 lần để đăng ký service

**systemd** là init system của Linux — quản lý services (nginx, redis, pm2...). Khi server boot, systemd đọc file `/etc/systemd/system/pm2-vanh.service` và start PM2.

### 6.4 Các lệnh PM2 hữu ích

```bash
pm2 status          # Xem tất cả processes
pm2 logs            # Xem logs real-time
pm2 logs api        # Xem logs của app cụ thể
pm2 restart all     # Restart tất cả
pm2 restart api     # Restart 1 app
pm2 stop all        # Dừng tất cả
pm2 delete all      # Xóa tất cả processes
pm2 monit           # Dashboard monitoring (CPU, RAM)
```

---

## 7. Nginx — Reverse Proxy

### Reverse Proxy là gì?

**Forward Proxy:** Client → Proxy → Internet (VPN, proxy server)
**Reverse Proxy:** Internet → Proxy → Backend Server (Nginx)

Nginx đứng giữa internet và ứng dụng, nhận tất cả request rồi quyết định chuyển tới app nào dựa trên domain name.

### Cấu hình Nginx

```bash
sudo nano /etc/nginx/sites-available/sslm
```

```nginx
# API Backend
server {
    listen 80;                              # Lắng nghe port 80 (HTTP)
    server_name api.avpegnu.io.vn;          # Chỉ xử lý request tới domain này

    location / {                            # Mọi path (/)
        proxy_pass http://localhost:3000;    # Chuyển tới NestJS app
        proxy_http_version 1.1;             # Dùng HTTP/1.1 (hỗ trợ WebSocket)
        proxy_set_header Upgrade $http_upgrade;     # WebSocket upgrade
        proxy_set_header Connection 'upgrade';      # WebSocket connection
        proxy_set_header Host $host;                # Giữ original host header
        proxy_set_header X-Real-IP $remote_addr;    # IP thật của client
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;  # Chain IP
        proxy_set_header X-Forwarded-Proto $scheme; # HTTP hay HTTPS
        proxy_cache_bypass $http_upgrade;            # Không cache WebSocket

        # SSE streaming support (AI Tutor)
        proxy_buffering off;                # Tắt buffering — gửi chunk ngay cho client
        proxy_read_timeout 86400s;          # Timeout 24h — AI response có thể lâu
        proxy_send_timeout 86400s;          # Timeout 24h — giữ connection cho client
    }
}
```

**Giải thích từng header:**
- `Host` — domain gốc, app cần biết để tạo URL đúng
- `X-Real-IP` — IP thật của client (không phải IP Nginx)
- `X-Forwarded-For` — danh sách IP qua các proxy
- `X-Forwarded-Proto` — `https` hay `http`, app dùng để redirect đúng
- `Upgrade` + `Connection` — cần cho WebSocket (Socket.io)

**SSE Streaming (Server-Sent Events):**
- `proxy_buffering off` — **bắt buộc** cho SSE. Mặc định Nginx buffer toàn bộ response rồi mới gửi cho client → AI Tutor trả 1 cục text thay vì stream từng token. Tắt buffering để Nginx forward từng chunk ngay khi nhận từ backend.
- `proxy_read_timeout 86400s` — mặc định 60s, nếu backend không gửi gì trong 60s → Nginx trả 504. AI Tutor có thể mất > 60s khi gọi LLM API.
- `proxy_send_timeout 86400s` — mặc định 60s, nếu client không nhận data trong 60s → Nginx đóng connection.

### Kích hoạt cấu hình

```bash
# Tạo symlink từ sites-available → sites-enabled
sudo ln -s /etc/nginx/sites-available/sslm /etc/nginx/sites-enabled/

# Kiểm tra cú pháp (LUÔN chạy trước reload!)
sudo nginx -t
# nginx: configuration file /etc/nginx/nginx.conf syntax is ok
# nginx: configuration file /etc/nginx/nginx.conf test is successful

# Reload Nginx (không downtime)
sudo systemctl reload nginx
```

**sites-available vs sites-enabled:**
- `sites-available/` — tất cả config files (kể cả chưa dùng)
- `sites-enabled/` — symlinks tới config đang active
- Muốn tắt site → xóa symlink, không xóa file gốc

**`nginx -t` vs `nginx -s reload`:**
- `-t` = test config (không áp dụng, chỉ kiểm tra lỗi cú pháp)
- `reload` = áp dụng config mới mà không cần restart (zero downtime)

---

## 8. SSL — Chứng chỉ bảo mật HTTPS

### SSL/TLS là gì?

**SSL** (Secure Sockets Layer) / **TLS** (Transport Layer Security) mã hóa traffic giữa browser và server. Không có SSL:
- Password gửi dạng plain text → bị sniff
- Trình duyệt hiện cảnh báo "Not Secure"
- Google giảm ranking SEO

### Let's Encrypt

**Let's Encrypt** — tổ chức phi lợi nhuận cấp SSL cert **miễn phí**, tự động, 90 ngày/lần.

### Certbot — Tự động hóa SSL

```bash
sudo certbot --nginx -d avpegnu.io.vn -d api.avpegnu.io.vn -d manage.avpegnu.io.vn
```

**Certbot làm gì khi chạy lệnh này:**
1. **Xác minh quyền sở hữu domain** — tạo file tạm trên server, Let's Encrypt truy cập qua HTTP để verify
2. **Xin chứng chỉ** — gửi CSR (Certificate Signing Request) tới Let's Encrypt
3. **Lưu cert** — `/etc/letsencrypt/live/avpegnu.io.vn/fullchain.pem` (cert) + `privkey.pem` (private key)
4. **Cấu hình Nginx** — tự động thêm SSL config vào file Nginx:
   ```nginx
   listen 443 ssl;
   ssl_certificate /etc/letsencrypt/live/avpegnu.io.vn/fullchain.pem;
   ssl_certificate_key /etc/letsencrypt/live/avpegnu.io.vn/privkey.pem;
   ```
5. **Redirect HTTP → HTTPS** — thêm redirect `301` từ port 80 → 443

### Tự động gia hạn

Certbot cài sẵn **cron job** hoặc **systemd timer** chạy 2 lần/ngày:
```bash
# Kiểm tra timer
sudo systemctl list-timers | grep certbot
```

Cert hết hạn sau 90 ngày, nhưng Certbot renew trước 30 ngày → thực tế cert luôn valid.

**Test renew thủ công:**
```bash
sudo certbot renew --dry-run
```

---

## 9. Tổng kết kiến trúc

### Request lifecycle (HTTPS)

```
1. User gõ https://avpegnu.io.vn/courses
2. Browser hỏi DNS: "avpegnu.io.vn IP là gì?" → 180.93.42.176
3. Browser mở TCP connection tới 180.93.42.176:443
4. TLS handshake (SSL cert verification)
5. Nginx nhận request, check server_name = "avpegnu.io.vn"
6. Nginx proxy_pass tới localhost:3001
7. Next.js (Student Portal) xử lý, render HTML
8. Response ngược lại: Next.js → Nginx → Browser
9. Browser render trang, gọi API:
   - fetch("https://api.avpegnu.io.vn/api/courses")
   - DNS → 180.93.42.176:443 → Nginx → localhost:3000
   - NestJS xử lý, query Neon PostgreSQL
   - Response: NestJS → Nginx → Browser
```

### Cấu trúc thư mục trên server

```
/home/vanh/vanh/smart-social-learning-marketplace/
├── apps/
│   ├── api/
│   │   ├── .env                    ← Biến môi trường backend
│   │   ├── dist/                   ← Build output (JavaScript)
│   │   └── src/prisma/migrations/  ← Database migrations
│   ├── student-portal/
│   │   ├── .env.local              ← Biến môi trường frontend
│   │   └── .next/                  ← Build output (Next.js)
│   └── management-portal/
│       ├── .env.local              ← Biến môi trường frontend
│       └── .next/                  ← Build output (Next.js)
├── packages/                       ← Shared code
└── node_modules/                   ← Dependencies

/etc/nginx/
├── sites-available/sslm            ← Nginx config file
└── sites-enabled/sslm → ../sites-available/sslm  ← Symlink

/etc/letsencrypt/live/avpegnu.io.vn/
├── fullchain.pem                   ← SSL certificate
└── privkey.pem                     ← SSL private key
```

### Các port

| Port | Protocol | Service | Truy cập |
|------|----------|---------|----------|
| 22 | TCP | SSH | Trực tiếp (quản trị) |
| 80 | HTTP | Nginx | Redirect → 443 |
| 443 | HTTPS | Nginx | Công khai (internet) |
| 3000 | HTTP | NestJS API | Chỉ localhost (qua Nginx) |
| 3001 | HTTP | Student Portal | Chỉ localhost (qua Nginx) |
| 3002 | HTTP | Management Portal | Chỉ localhost (qua Nginx) |
| 6379 | TCP | Redis | Chỉ localhost |

### Lệnh quản trị thường dùng

```bash
# PM2
pm2 status                    # Xem trạng thái apps
pm2 logs                      # Xem logs
pm2 restart all               # Restart tất cả
pm2 restart api               # Restart 1 app

# Nginx
sudo nginx -t                 # Test config
sudo systemctl reload nginx   # Reload config
sudo systemctl status nginx   # Xem trạng thái

# SSL
sudo certbot renew --dry-run  # Test renew
sudo certbot certificates     # Xem cert hiện tại

# Redis
redis-cli ping                # Test connection → PONG

# Database
cd apps/api
npx prisma migrate deploy     # Apply new migrations
npx prisma db seed            # Seed data
npx prisma studio             # GUI xem database (dev only)
```
