# 02 — Docker & Infrastructure (PostgreSQL, Redis, pgAdmin)

> Giải thích Docker, containers, và file docker-compose.yml trong project.

---

## 1. DOCKER LÀ GÌ?

### 1.1 Vấn đề Docker giải quyết

Trước Docker, để setup môi trường development:

1. Install PostgreSQL trên máy → phiên bản khác nhau giữa Windows/macOS/Linux
2. Install Redis trên máy → Windows không hỗ trợ native Redis
3. Mỗi developer config khác nhau → "chạy máy tui được, máy bạn không"

**Docker giải quyết:** Đóng gói ứng dụng + dependencies vào **container** — một môi trường cô lập, chạy giống nhau trên mọi máy.

### 1.2 Các khái niệm cốt lõi

| Khái niệm          | Giải thích                                                  | Ví dụ trong project                    |
| ------------------ | ----------------------------------------------------------- | -------------------------------------- |
| **Image**          | "Bản thiết kế" — file read-only chứa OS + ứng dụng + config | `postgres:16-alpine`, `redis:7-alpine` |
| **Container**      | "Instance" chạy từ image — có state riêng                   | `sslm-postgres`, `sslm-redis`          |
| **Volume**         | Ổ cứng ảo để lưu data persistent                            | `pgdata`, `redisdata`                  |
| **Port mapping**   | Kết nối port máy host ↔ port container                      | `5432:5432` (host:container)           |
| **Docker Compose** | Tool quản lý nhiều containers cùng lúc                      | `docker-compose.yml`                   |

### 1.3 Image tag "-alpine" nghĩa gì?

```
postgres:16-alpine
         │   │
         │   └── Alpine Linux — bản Linux siêu nhẹ (~5MB vs ~100MB)
         └────── PostgreSQL version 16
```

Alpine images nhỏ hơn nhiều so với default images, download nhanh, chiếm ít disk.

---

## 2. FILE docker-compose.yml CHI TIẾT

### 2.1 Tổng quan

```yaml
services: # Danh sách các containers cần chạy
  postgres: # Container 1: PostgreSQL database
  redis: # Container 2: Redis cache
  pgadmin: # Container 3: pgAdmin web UI

volumes: # Persistent storage
  pgdata: # Data PostgreSQL
  redisdata: # Data Redis
  pgadmindata: # Data pgAdmin
```

### 2.2 PostgreSQL Container

```yaml
postgres:
  image: postgres:16-alpine # Dùng PostgreSQL 16 trên Alpine Linux
  container_name: sslm-postgres # Tên container (dễ identify)
  restart: unless-stopped # Tự restart khi crash (trừ khi stop thủ công)
  ports:
    - '5432:5432' # Map port: máy host 5432 → container 5432
  environment:
    POSTGRES_USER: sslm_user # Username để connect
    POSTGRES_PASSWORD: sslm_password # Password
    POSTGRES_DB: sslm_dev # Tên database tạo sẵn
  volumes:
    - pgdata:/var/lib/postgresql/data # Lưu data vào volume (persist khi restart)
  healthcheck:
    test: ['CMD-SHELL', 'pg_isready -U sslm_user -d sslm_dev']
    interval: 10s # Check mỗi 10 giây
    timeout: 5s # Timeout sau 5 giây
    retries: 5 # Thử 5 lần trước khi báo unhealthy
```

#### PostgreSQL là gì?

**PostgreSQL** (hay Postgres) là Relational Database Management System (RDBMS) — hệ quản trị cơ sở dữ liệu quan hệ. Dữ liệu được lưu trong **tables** (bảng) với **rows** (hàng) và **columns** (cột), liên kết qua **foreign keys** (khóa ngoại).

**Tại sao chọn PostgreSQL cho project này?**

- **pgvector extension**: Hỗ trợ vector embeddings cho AI Tutor (semantic search)
- **Mature & reliable**: 35+ năm phát triển, dùng bởi Instagram, Spotify, Uber
- **Full-text search**: Hỗ trợ tìm kiếm text tiếng Việt
- **JSON support**: Lưu structured data linh hoạt
- **Neon.tech**: Dịch vụ managed PostgreSQL free tier cho production

#### Volume là gì?

```yaml
volumes:
  - pgdata:/var/lib/postgresql/data
```

Khi container bị xóa (docker compose down), data bên trong container cũng bị mất. **Volume** giải quyết vấn đề này bằng cách lưu data ra ngoài container.

```
Không có volume:
  Container bị xóa → DATA MẤT ❌

Có volume:
  Container bị xóa → Data vẫn trong volume ✅
  Tạo container mới → Mount volume cũ → Data vẫn đầy đủ ✅
```

Lưu ý: `docker compose down` giữ volumes, `docker compose down -v` XÓA volumes (reset data).

#### Healthcheck là gì?

```yaml
healthcheck:
  test: ['CMD-SHELL', 'pg_isready -U sslm_user -d sslm_dev']
```

`pg_isready` là command kiểm tra PostgreSQL đã sẵn sàng nhận connection chưa. Docker sẽ:

1. Chạy command này mỗi 10s
2. Nếu OK → container status = `healthy`
3. Nếu fail 5 lần liên tiếp → status = `unhealthy`

Healthcheck quan trọng vì pgAdmin cần đợi PostgreSQL ready trước khi start (xem `depends_on` bên dưới).

### 2.3 Redis Container

```yaml
redis:
  image: redis:7-alpine
  container_name: sslm-redis
  restart: unless-stopped
  ports:
    - '6379:6379' # Port mặc định của Redis
  volumes:
    - redisdata:/data # Persist Redis data
  healthcheck:
    test: ['CMD', 'redis-cli', 'ping'] # Redis trả "PONG" nếu healthy
    interval: 10s
    timeout: 5s
    retries: 5
```

#### Redis là gì?

**Redis** (Remote Dictionary Server) là **in-memory data store** — lưu data trong RAM thay vì disk, nên cực nhanh (microseconds vs milliseconds).

**Dùng Redis trong project để:**

| Use case          | Giải thích                                                              |
| ----------------- | ----------------------------------------------------------------------- |
| **Caching**       | Cache kết quả query phổ biến (course list, user profile) → giảm load DB |
| **Session store** | Lưu refresh token, OTT (One-Time Token) với TTL (Time To Live)          |
| **Rate limiting** | Giới hạn request AI Tutor (30 req/min theo Groq free tier)              |
| **Job queue**     | Bull queue dùng Redis làm backend cho background jobs                   |
| **Real-time**     | Pub/Sub cho notifications, online status                                |

**So sánh PostgreSQL vs Redis:**

```
PostgreSQL (Disk-based):
  ✅ Data bền vững, survive restart
  ✅ Complex queries (JOIN, GROUP BY, WHERE)
  ✅ ACID transactions
  ❌ Chậm hơn cho reads đơn giản

Redis (Memory-based):
  ✅ Cực nhanh (100K+ ops/sec)
  ✅ TTL tự động xóa data expired
  ✅ Data structures (List, Set, Hash, Sorted Set)
  ❌ Data có thể mất khi crash (trừ khi persist)
  ❌ Giới hạn bởi RAM
```

### 2.4 pgAdmin Container

```yaml
pgadmin:
  image: dpage/pgadmin4:latest
  container_name: sslm-pgadmin
  restart: unless-stopped
  ports:
    - '5050:80' # Truy cập tại http://localhost:5050
  environment:
    PGADMIN_DEFAULT_EMAIL: admin@sslm.dev # Login email
    PGADMIN_DEFAULT_PASSWORD: admin # Login password
    PGADMIN_CONFIG_SERVER_MODE: 'False' # Desktop mode (bỏ qua multi-user)
  volumes:
    - pgadmindata:/var/lib/pgadmin
  depends_on:
    postgres:
      condition: service_healthy # Chờ PostgreSQL healthy mới start
```

#### pgAdmin là gì?

**pgAdmin** là GUI tool để quản lý PostgreSQL database qua web browser. Thay vì viết SQL commands trong terminal, bạn có thể:

- Xem/tạo/sửa/xóa tables bằng giao diện
- Chạy SQL queries với syntax highlighting
- Xem data dạng bảng (giống Excel)
- Export/Import data
- Xem statistics, performance metrics

#### depends_on với condition

```yaml
depends_on:
  postgres:
    condition: service_healthy
```

Nghĩa là: "Chỉ start pgAdmin SAU KHI PostgreSQL container đã healthy". Nếu không có condition này, pgAdmin có thể start trước khi PostgreSQL ready → lỗi connection.

#### Kết nối pgAdmin đến PostgreSQL

Khi cả pgAdmin và PostgreSQL đều chạy trong Docker:

- **KHÔNG dùng** `localhost` làm host (vì mỗi container có network riêng)
- **Dùng** `postgres` (tên service trong docker-compose) — Docker DNS tự resolve

```
pgAdmin config:
  Host: postgres          ← Tên service, KHÔNG phải localhost
  Port: 5432
  Username: sslm_user
  Password: sslm_password
  Database: sslm_dev
```

### 2.5 Named Volumes

```yaml
volumes:
  pgdata: # PostgreSQL data
  redisdata: # Redis data
  pgadmindata: # pgAdmin config/sessions
```

Docker quản lý các volumes này ở internal location. Có thể xem bằng `docker volume ls`.

---

## 3. CÁC LỆNH DOCKER COMPOSE

| Lệnh               | Script                                           | Giải thích                                             |
| ------------------ | ------------------------------------------------ | ------------------------------------------------------ |
| `npm run db:dev`   | `docker compose up -d`                           | Start tất cả containers ở background (`-d` = detached) |
| `npm run db:stop`  | `docker compose down`                            | Stop và xóa containers (giữ volumes)                   |
| `npm run db:reset` | `docker compose down -v && docker compose up -d` | Xóa containers + volumes (RESET DATA) rồi start lại    |

### 3.1 Lifecycle của containers

```
docker compose up -d
  → Pull images (lần đầu)
  → Create containers
  → Start containers
  → Containers running in background

docker compose down
  → Stop containers
  → Remove containers
  → Volumes vẫn còn (data safe)

docker compose down -v
  → Stop containers
  → Remove containers
  → Remove volumes (DATA MẤT!)
```

### 3.2 Các lệnh debug hữu ích

```bash
docker compose ps          # Xem status tất cả containers
docker compose logs -f     # Xem logs real-time (Ctrl+C để thoát)
docker compose logs postgres  # Logs chỉ PostgreSQL
docker exec -it sslm-postgres psql -U sslm_user -d sslm_dev  # Vào PostgreSQL CLI
docker exec -it sslm-redis redis-cli  # Vào Redis CLI
```

---

## 4. PORT MAPPING — TỔNG KẾT

```
┌─────────────────────────────────────────────────────┐
│                    Host Machine                      │
│                                                      │
│  localhost:3000  → NestJS API                        │
│  localhost:3001  → Student Portal (Next.js)          │
│  localhost:3002  → Management Portal (Next.js)       │
│  localhost:5050  → pgAdmin Web UI                    │
│                                                      │
│  ┌─── Docker ────────────────────────────────┐      │
│  │                                            │      │
│  │  localhost:5432 → sslm-postgres (PostgreSQL)│     │
│  │  localhost:6379 → sslm-redis (Redis)        │     │
│  │  localhost:5050 → sslm-pgadmin (pgAdmin)    │     │
│  │                                            │      │
│  └────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────┘
```

**Lưu ý:** NestJS và Next.js chạy TRỰC TIẾP trên host machine (không trong Docker), nên chúng kết nối đến PostgreSQL/Redis qua `localhost:5432` / `localhost:6379`.
