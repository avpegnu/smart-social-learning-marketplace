# Phase 6.2 — CI/CD Pipeline: Tự động deploy khi push code

> Tài liệu giải thích chi tiết cách thiết lập CI/CD pipeline
> để tự động deploy dự án SSLM lên production server khi push code lên branch `main`.

---

## Mục lục

1. [CI/CD là gì?](#1-cicd-là-gì)
2. [Kiến trúc CI/CD của SSLM](#2-kiến-trúc-cicd-của-sslm)
3. [SSH Key — Xác thực không mật khẩu](#3-ssh-key--xác-thực-không-mật-khẩu)
4. [GitHub Secrets — Bảo mật thông tin nhạy cảm](#4-github-secrets--bảo-mật-thông-tin-nhạy-cảm)
5. [Deploy Script — Quy trình triển khai](#5-deploy-script--quy-trình-triển-khai)
6. [GitHub Actions Workflow — Tự động hóa](#6-github-actions-workflow--tự-động-hóa)
7. [Health Check Endpoint — Kiểm tra sức khỏe hệ thống](#7-health-check-endpoint--kiểm-tra-sức-khỏe-hệ-thống)
8. [Troubleshooting — Xử lý sự cố](#8-troubleshooting--xử-lý-sự-cố)

---

## 1. CI/CD là gì?

### Định nghĩa

- **CI (Continuous Integration)** — Tích hợp liên tục: tự động kiểm tra code mỗi khi có thay đổi (lint, test, build).
- **CD (Continuous Deployment)** — Triển khai liên tục: tự động đưa code mới lên production sau khi CI pass.

### Tại sao cần CI/CD?

**Không có CI/CD (thủ công):**
```
1. Developer push code lên GitHub
2. SSH vào server
3. cd ~/project
4. git pull
5. npm install
6. npm run build
7. pm2 restart all
→ Mất 5-10 phút, dễ quên bước, dễ sai
```

**Có CI/CD (tự động):**
```
1. Developer push code lên GitHub
→ Xong! Mọi thứ tự động chạy trong 2-3 phút
```

### Pipeline của SSLM

```
Developer push to main
         │
         ▼
┌─────────────────────┐
│   GitHub Actions     │
│   (CI/CD Runner)     │
│                      │
│  1. Detect push      │
│  2. SSH vào server   │
│  3. Chạy deploy.sh   │
└─────────┬───────────┘
          │ SSH
          ▼
┌─────────────────────┐
│   Production Server  │
│   (180.93.42.176)    │
│                      │
│  1. git pull         │
│  2. npm install      │
│  3. prisma generate  │
│  4. prisma migrate   │
│  5. npm run build    │
│  6. pm2 restart all  │
└─────────────────────┘
          │
          ▼
    Website cập nhật ✅
```

---

## 2. Kiến trúc CI/CD của SSLM

### Thành phần

| Thành phần | Vai trò | Vị trí |
|------------|---------|--------|
| **GitHub Actions** | CI/CD runner — phát hiện push, kích hoạt deploy | GitHub cloud |
| **SSH Key** | Xác thực GitHub Actions với server (không cần password) | Server + GitHub Secrets |
| **GitHub Secrets** | Lưu trữ thông tin nhạy cảm (IP, key) an toàn | GitHub repo settings |
| **deploy.sh** | Script chứa các bước deploy cụ thể | Server (`~/deploy.sh`) |
| **PM2** | Restart ứng dụng sau khi build xong | Server |

### So sánh với các phương pháp khác

| Phương pháp | Ưu điểm | Nhược điểm |
|-------------|---------|------------|
| **SSH deploy (đang dùng)** | Đơn giản, nhanh, không cần Docker | Build trên server (tốn RAM) |
| **Docker + Registry** | Isolated, reproducible | Phức tạp, cần Docker trên server |
| **Vercel/Render** | Zero config, auto SSL | Giới hạn free tier, ít control |
| **Kubernetes** | Scale, self-healing | Quá phức tạp cho thesis |

**Lý do chọn SSH deploy:** Server VPS đủ mạnh để build, setup đơn giản, phù hợp thesis project.

---

## 3. SSH Key — Xác thực không mật khẩu

### SSH Key là gì?

SSH Key là cặp key mật mã (public + private) dùng để xác thực khi kết nối SSH, thay thế password.

- **Private key** — giữ bí mật, ai có key này = có quyền truy cập server
- **Public key** — đặt trên server, dùng để verify private key

### Cách hoạt động

```
GitHub Actions (có private key)
         │
         │ SSH connection request
         ▼
Server (có public key trong authorized_keys)
         │
         │ Verify: "Private key khớp với public key không?"
         │ → Khớp → Cho phép truy cập ✅
         │ → Không khớp → Từ chối ❌
```

### Tạo SSH Key

```bash
ssh-keygen -t ed25519 -C "deploy" -f ~/.ssh/deploy_key -N ""
```

**Giải thích từng flag:**
- `-t ed25519` — thuật toán mã hóa Ed25519 (hiện đại, an toàn, nhanh hơn RSA)
- `-C "deploy"` — comment/label cho key (để nhận biết)
- `-f ~/.ssh/deploy_key` — đường dẫn lưu file key
- `-N ""` — passphrase rỗng (không hỏi mật khẩu khi dùng key — cần thiết cho automation)

**Output:** 2 files
- `~/.ssh/deploy_key` — **private key** (KHÔNG ĐƯỢC CHIA SẺ)
- `~/.ssh/deploy_key.pub` — **public key** (an toàn để chia sẻ)

### Đăng ký public key trên server

```bash
cat ~/.ssh/deploy_key.pub >> ~/.ssh/authorized_keys
```

- `>>` — append (thêm vào cuối file, không ghi đè)
- `authorized_keys` — file chứa danh sách public keys được phép SSH vào server
- Mỗi dòng = 1 public key = 1 người/service được phép truy cập

### Bảo mật

⚠️ **KHÔNG BAO GIỜ chia sẻ private key công khai** (chat, email, commit lên git).
Nếu private key bị lộ:
1. Xóa key cũ: `rm ~/.ssh/deploy_key*`
2. Xóa khỏi `authorized_keys`
3. Tạo key mới
4. Cập nhật GitHub Secret

---

## 4. GitHub Secrets — Bảo mật thông tin nhạy cảm

### GitHub Secrets là gì?

Biến môi trường **mã hóa** lưu trên GitHub, chỉ GitHub Actions workflow mới đọc được. Không hiển thị trong logs, không ai có thể xem giá trị sau khi lưu.

### Các secrets cần thiết

| Secret Name | Giá trị | Mục đích |
|-------------|---------|----------|
| `SERVER_HOST` | `180.93.42.176` | IP address của production server |
| `SERVER_USER` | `vanh` | Username SSH vào server |
| `SERVER_SSH_KEY` | `-----BEGIN OPENSSH...` | Private key để xác thực SSH |

### Cách thêm secret

```
GitHub repo → Settings → Secrets and variables → Actions → New repository secret
```

### Sử dụng trong workflow

```yaml
${{ secrets.SERVER_HOST }}      # → 180.93.42.176
${{ secrets.SERVER_USER }}      # → vanh
${{ secrets.SERVER_SSH_KEY }}   # → (private key content)
```

GitHub tự động mask giá trị secrets trong logs (hiển thị `***` thay vì giá trị thật).

---

## 5. Deploy Script — Quy trình triển khai

### File: `~/deploy.sh`

```bash
#!/bin/bash
set -e

cd ~/vanh/smart-social-learning-marketplace

echo "Pulling latest code..."
git pull origin main

echo "Installing dependencies..."
npm install --production=false

echo "Generating Prisma client..."
cd apps/api
npx prisma generate
npx prisma migrate deploy || true
cd ../..

echo "Building..."
npm run build

echo "Restarting apps..."
pm2 restart all

echo "Deploy complete!"
```

### Giải thích từng bước

#### `#!/bin/bash`
**Shebang** — cho hệ điều hành biết dùng `/bin/bash` để chạy script này. Bắt buộc ở dòng đầu tiên của mọi shell script.

#### `set -e`
**Exit on error** — nếu BẤT KỲ lệnh nào trong script fail (return code ≠ 0), script dừng ngay lập tức. Tránh trường hợp:
- `git pull` fail → vẫn chạy `npm run build` với code cũ → deploy sai version

#### `git pull origin main`
Tải code mới nhất từ GitHub về server. Chỉ tải **diff** (thay đổi), không tải lại toàn bộ.

#### `npm install --production=false`
Cài dependencies. Flag `--production=false` đảm bảo cài cả `devDependencies` — cần thiết vì:
- `typescript` — dùng khi build
- `@nestjs/cli` — dùng cho `nest build`
- `prisma` — dùng cho `prisma generate`

Nếu thiếu devDependencies, build sẽ fail.

#### `npx prisma generate`
Sinh lại Prisma Client từ `schema.prisma`. Cần chạy mỗi khi:
- Schema thay đổi (thêm/sửa model)
- `node_modules` bị xóa hoặc cài lại
- Deploy lên máy mới

#### `npx prisma migrate deploy || true`
Apply migrations mới lên database production. `|| true` nghĩa là:
- Nếu thành công → tiếp tục
- Nếu fail (không có migration mới, hoặc đã apply rồi) → vẫn tiếp tục, không dừng script

#### `npm run build`
Turborepo build song song cả 3 apps:
- NestJS → compile TypeScript → JavaScript (`dist/`)
- Student Portal → Next.js optimize build (`.next/`)
- Management Portal → Next.js optimize build (`.next/`)

#### `pm2 restart all`
Restart tất cả PM2 processes. PM2 sẽ:
1. Gửi SIGTERM tới process cũ
2. Đợi process tắt gracefully (1.6s timeout)
3. Start process mới với code vừa build

#### `chmod +x ~/deploy.sh`
Thêm quyền **executable** cho file. Linux phân biệt 3 quyền:
- `r` (read) — đọc file
- `w` (write) — ghi/sửa file
- `x` (execute) — chạy file như chương trình

File mới tạo mặc định không có quyền `x` → không thể chạy `~/deploy.sh` trực tiếp.

---

## 6. GitHub Actions Workflow — Tự động hóa

### File: `.github/workflows/deploy.yml`

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SERVER_SSH_KEY }}
          script: ~/deploy.sh
```

### Giải thích từng phần

#### `name: Deploy to Production`
Tên workflow — hiển thị trên GitHub Actions UI.

#### `on: push: branches: [main]`
**Trigger** — workflow chạy khi nào?
- `push` → khi có code mới được push
- `branches: [main]` → chỉ branch `main`

Tức là: push lên branch `feature/xxx` → KHÔNG chạy. Merge/push vào `main` → chạy deploy.

#### `jobs: deploy:`
**Job** — một đơn vị công việc. Một workflow có thể có nhiều jobs (test, build, deploy).

#### `runs-on: ubuntu-latest`
Job chạy trên máy ảo Ubuntu do GitHub cung cấp miễn phí (GitHub-hosted runner). Máy ảo này tồn tại trong thời gian job chạy, sau đó bị hủy.

#### `uses: appleboy/ssh-action@v1`
**Action** — module tái sử dụng. `appleboy/ssh-action` là action phổ biến để SSH vào server từ GitHub Actions.

Nó thực hiện:
1. Tạo SSH connection tới server bằng key
2. Chạy lệnh/script được chỉ định
3. Trả về output + exit code

#### `with:` block
Truyền tham số cho action:
- `host` — IP server (từ GitHub Secret)
- `username` — user SSH (từ GitHub Secret)
- `key` — private key SSH (từ GitHub Secret)
- `script` — lệnh chạy trên server (`~/deploy.sh`)

### Flow thực thi

```
1. Developer: git push origin main
2. GitHub: phát hiện push → trigger workflow
3. GitHub: tạo VM Ubuntu → cài ssh-action
4. ssh-action: SSH vào 180.93.42.176 bằng private key
5. Server: chạy ~/deploy.sh
   → git pull → npm install → build → pm2 restart
6. ssh-action: nhận exit code 0 → job ✅ (hoặc ≠ 0 → job ❌)
7. GitHub: hiển thị kết quả trên Actions tab
```

### Thời gian chạy

| Bước | Thời gian ước tính |
|------|-------------------|
| GitHub trigger + SSH connect | ~5s |
| git pull | ~2s |
| npm install (cached) | ~10s |
| prisma generate + migrate | ~5s |
| npm run build | ~90s |
| pm2 restart | ~3s |
| **Tổng** | **~2 phút** |

---

## 7. Health Check Endpoint — Kiểm tra sức khỏe hệ thống

### Endpoint: `GET /api/health`

Health check endpoint cho phép kiểm tra nhanh trạng thái toàn bộ hệ thống — API server, database, Redis đều hoạt động hay không.

### Response mẫu

```json
{
  "status": "healthy",
  "version": "0.0.1",
  "timestamp": "2026-03-22T12:00:00.000Z",
  "uptime": "3600s",
  "memory": "150MB",
  "node": "v22.22.1",
  "checks": {
    "database": "ok",
    "redis": "ok"
  }
}
```

### Giải thích các trường

| Trường | Ý nghĩa |
|--------|---------|
| `status` | `healthy` = tất cả OK, `degraded` = có service lỗi |
| `version` | Version từ package.json |
| `timestamp` | Thời điểm check (ISO 8601) |
| `uptime` | Thời gian server chạy liên tục (giây) |
| `memory` | RAM đang dùng (RSS — Resident Set Size) |
| `node` | Phiên bản Node.js |
| `checks.database` | Kết quả `SELECT 1` trên PostgreSQL |
| `checks.redis` | Kết quả `PING` trên Redis → `PONG` |

### Cách kiểm tra

```bash
# Từ trình duyệt
https://api.avpegnu.io.vn/api/health

# Từ terminal
curl -s https://api.avpegnu.io.vn/api/health | jq
```

### Ứng dụng

1. **Monitoring** — cron job gọi health check mỗi 5 phút, alert khi `status ≠ healthy`
2. **Load balancer** — nếu dùng nhiều server, LB kiểm tra health trước khi route traffic
3. **CI/CD verification** — sau deploy, gọi health check để verify deploy thành công
4. **Uptime monitoring** — dịch vụ như UptimeRobot gọi endpoint này để track uptime

### Implementation

```typescript
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Get()
  @Public()  // Không cần authentication
  async check() {
    // Check database: chạy query đơn giản nhất
    await this.prisma.$queryRaw`SELECT 1`;

    // Check Redis: gửi PING, expect PONG
    await this.redis.ping();

    // Trả về tổng hợp
    return { status, checks, uptime, memory, ... };
  }
}
```

**`@Public()`** — decorator bỏ qua JWT authentication. Health check cần accessible mà không cần đăng nhập — monitoring tools, load balancers cần gọi được.

**`SELECT 1`** — query nhẹ nhất có thể, chỉ kiểm tra connection hoạt động, không đọc data.

**`redis.ping()`** — lệnh Redis đơn giản nhất, trả về `PONG` nếu connected.

---

## 8. Troubleshooting — Xử lý sự cố

### Deploy fail — Kiểm tra logs

```bash
# Xem GitHub Actions logs
# GitHub repo → Actions tab → click vào workflow run → xem logs

# Xem PM2 logs trên server
pm2 logs --lines 50

# Xem Nginx error logs
sudo tail -50 /var/log/nginx/error.log
```

### Lỗi thường gặp

#### SSH connection refused
```
Error: ssh: connect to host 180.93.42.176 port 22: Connection refused
```
**Nguyên nhân:** SSH service không chạy hoặc firewall chặn port 22
**Fix:**
```bash
sudo systemctl status sshd
sudo ufw allow 22
```

#### Permission denied (publickey)
```
Error: Permission denied (publickey)
```
**Nguyên nhân:** Private key không khớp với public key trên server
**Fix:**
1. Tạo lại SSH key
2. Cập nhật `authorized_keys` trên server
3. Cập nhật GitHub Secret `SERVER_SSH_KEY`

#### Build fail — out of memory
```
FATAL ERROR: Reached heap limit Allocation failed
```
**Nguyên nhân:** Server không đủ RAM để build (Next.js build tốn ~1-2GB RAM)
**Fix:**
```bash
# Tạo swap file (dùng disk làm RAM ảo)
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

#### prisma migrate deploy fail
```
Error: P3009 migrate found failed migrations
```
**Nguyên nhân:** Migration trước đó fail giữa chừng
**Fix:**
```bash
cd apps/api
npx prisma migrate resolve --applied <migration_name>
```

#### AI Tutor indexing fail — `column "embedding" does not exist`
```
Raw query failed. Code: 42703.
Message: column "embedding" of relation "course_chunks" does not exist
```
**Nguyên nhân:** Migration `20260323000000_add_pgvector_embedding` chạy `CREATE EXTENSION IF NOT EXISTS vector;` nhưng trên Neon nếu extension `vector` chưa được enable, câu lệnh này fail silently và `ALTER TABLE ... vector(384)` ngay sau đó cũng fail (không có type). Prisma vẫn đánh dấu migration là "applied" → cột `embedding` **không tồn tại** dù log không báo lỗi.

**Fix — chạy tay trên [Neon SQL Editor](https://console.neon.tech):**
```sql
-- 1. Bật pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Verify extension
SELECT * FROM pg_extension WHERE extname = 'vector';

-- 3. Add embedding column
ALTER TABLE course_chunks ADD COLUMN IF NOT EXISTS embedding vector(384);

-- 4. Create HNSW index cho vector search
CREATE INDEX IF NOT EXISTS course_chunks_embedding_idx
  ON course_chunks USING hnsw (embedding vector_cosine_ops);

-- 5. Verify column
SELECT column_name, udt_name
FROM information_schema.columns
WHERE table_name = 'course_chunks' AND column_name = 'embedding';
```

**Prevention:** Luôn bật `vector` extension trên Neon project **trước** khi lần đầu chạy `prisma migrate deploy` hoặc `prisma migrate reset`. Xem [01-deployment-guide.md §4.1](01-deployment-guide.md#41-neontech--postgresql-database) để biết chi tiết.

### Rollback — Quay lại version cũ

```bash
# Trên server
cd ~/vanh/smart-social-learning-marketplace

# Xem lịch sử commits
git log --oneline -10

# Quay lại commit cụ thể
git checkout <commit-hash>

# Build lại
npm run build
pm2 restart all
```

### Kiểm tra sau deploy

```bash
# 1. Health check
curl -s https://api.avpegnu.io.vn/api/health | jq

# 2. PM2 status
pm2 status

# 3. Nginx status
sudo systemctl status nginx

# 4. Check SSL cert
sudo certbot certificates
```
