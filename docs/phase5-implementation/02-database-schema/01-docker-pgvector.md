# 01 — Docker pgvector & PostgreSQL Extensions

> Giải thích tại sao đổi Docker image sang pgvector, extension là gì, và vector database dùng cho AI.

---

## 1. TẠI SAO ĐỔI DOCKER IMAGE?

### 1.1 Trước (Phase 5.1)

```yaml
# docker-compose.yml ban đầu
postgres:
  image: postgres:16-alpine # PostgreSQL thuần, không có pgvector
```

### 1.2 Sau (Phase 5.2)

```yaml
# docker-compose.yml sau khi đổi
postgres:
  image: pgvector/pgvector:pg16 # PostgreSQL 16 + pgvector extension sẵn
```

### 1.3 Lý do đổi

Project SSLM cần **vector search** cho tính năng **AI Tutor** — cụ thể là RAG (Retrieval-Augmented Generation). Khi student hỏi AI Tutor về nội dung khóa học, hệ thống cần:

1. Chia nội dung khóa học thành các "chunks" nhỏ
2. Mỗi chunk được chuyển thành **embedding vector** (mảng 384 số thực)
3. Khi student hỏi → chuyển câu hỏi thành vector → tìm chunks gần nhất → đưa vào prompt cho LLM

PostgreSQL thuần **không hỗ trợ** kiểu dữ liệu `vector` và các phép tính cosine similarity. Image `pgvector/pgvector:pg16` có sẵn extension `vector` — chỉ cần `CREATE EXTENSION vector;` là dùng được.

---

## 2. POSTGRESQL EXTENSION LÀ GÌ?

### 2.1 Khái niệm

**Extension** là "plugin" cho PostgreSQL — thêm kiểu dữ liệu mới, hàm mới, index mới mà PostgreSQL mặc định không có.

```sql
-- Cài extension (chỉ cần chạy 1 lần per database)
CREATE EXTENSION IF NOT EXISTS vector;
```

### 2.2 Các extension dùng trong SSLM

| Extension | Mục đích                                              | Có sẵn trong image?           |
| --------- | ----------------------------------------------------- | ----------------------------- |
| `vector`  | Kiểu dữ liệu vector, cosine similarity, IVFFlat index | Cần image `pgvector/pgvector` |
| `pg_trgm` | Fuzzy text search (trigram matching)                  | Có sẵn trong mọi PostgreSQL   |
| Tsvector  | Full-text search (built-in, không phải extension)     | Có sẵn                        |

### 2.3 Extension vs Built-in

```
PostgreSQL Built-in:
├── Kiểu dữ liệu: INT, VARCHAR, JSON, BOOLEAN, TIMESTAMP...
├── Index: B-tree, Hash, GIN, GiST
├── Full-text search: tsvector, tsquery, to_tsvector()
└── Triggers, Functions, Views...

Extension (cần cài thêm):
├── vector → kiểu dữ liệu vector(N), toán tử <->, <=>, index IVFFlat/HNSW
├── pg_trgm → fuzzy search với trigrams
├── uuid-ossp → generate UUID v4
└── ... hàng trăm extensions khác
```

---

## 3. PGVECTOR CHI TIẾT

### 3.1 Vector là gì?

**Vector** (trong ngữ cảnh AI/ML) là một **mảng số thực** đại diện cho "ý nghĩa" của một đoạn text.

```
"Học React cơ bản" → [0.12, -0.34, 0.56, 0.78, ..., 0.01]  (384 số)
"React cho người mới" → [0.11, -0.33, 0.55, 0.79, ..., 0.02]  (384 số, gần giống)
"Nấu phở Hà Nội" → [0.89, 0.45, -0.67, 0.12, ..., 0.88]  (384 số, rất khác)
```

Hai câu có ý nghĩa gần nhau → vector gần nhau → **cosine similarity cao**.

### 3.2 Tại sao 384 dimensions?

Project dùng model **all-MiniLM-L6-v2** (từ Sentence Transformers) để tạo embeddings:

- Chạy được bằng **Transformers.js** (JavaScript, không cần Python)
- Mỗi embedding có **384 dimensions** (384 số thực)
- Model nhẹ (~23MB), phù hợp free tier

```sql
-- Cột embedding trong bảng course_chunks
ALTER TABLE course_chunks ADD COLUMN embedding vector(384);
--                                              ^^^^^^^^^^
--                                     384 dimensions, khớp với model
```

### 3.3 Cosine Similarity

Đo độ tương đồng giữa 2 vectors — giá trị từ -1 đến 1:

```
Cosine = 1.0  → hoàn toàn giống nhau
Cosine = 0.0  → không liên quan
Cosine = -1.0 → hoàn toàn ngược nhau
```

```sql
-- Tìm 5 chunks gần nhất với câu hỏi (vector của câu hỏi = $1)
SELECT id, content, 1 - (embedding <=> $1) AS similarity
FROM course_chunks
WHERE course_id = 'xxx'
ORDER BY embedding <=> $1
LIMIT 5;

-- Toán tử <=> = cosine distance (1 - cosine similarity)
-- ORDER BY distance ASC = gần nhất trước
```

### 3.4 IVFFlat Index

Khi có nhiều vectors (hàng nghìn chunks), tìm kiếm tuần tự rất chậm. **IVFFlat** (Inverted File with Flat quantization) là thuật toán index:

```sql
CREATE INDEX idx_course_chunks_embedding
  ON course_chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
```

**Cách hoạt động:**

```
Không có index (brute force):
  Câu hỏi → so sánh với TẤT CẢ 10,000 chunks → chậm

Có IVFFlat index (lists = 100):
  1. Chia 10,000 chunks thành 100 "clusters" (groups)
  2. Mỗi cluster có 1 centroid (điểm đại diện)
  3. Câu hỏi → so sánh với 100 centroids → chọn top clusters gần nhất
  4. Chỉ search trong các chunks của clusters đó → nhanh hơn nhiều
```

| Tham số             | Ý nghĩa                                                         |
| ------------------- | --------------------------------------------------------------- |
| `lists = 100`       | Số clusters. Càng nhiều → index nhanh hơn nhưng recall thấp hơn |
| `vector_cosine_ops` | Dùng cosine distance để so sánh (phù hợp text embeddings)       |

### 3.5 Khi nào IVFFlat vs HNSW?

| Thuật toán  | Ưu điểm             | Nhược điểm            | Khi nào dùng               |
| ----------- | ------------------- | --------------------- | -------------------------- |
| **IVFFlat** | Build nhanh, ít RAM | Recall thấp hơn       | Data < 1M vectors          |
| **HNSW**    | Recall cao hơn      | Build chậm, nhiều RAM | Data lớn, cần accuracy cao |

SSLM chọn IVFFlat vì data nhỏ (free tier, max vài nghìn chunks) và build nhanh hơn.

---

## 4. FLOW AI TUTOR TRONG SSLM

```
Student hỏi: "Giải thích useEffect trong React?"
                    │
                    ▼
        ┌──────────────────────┐
        │ 1. Tạo embedding     │  Transformers.js (all-MiniLM-L6-v2)
        │    cho câu hỏi       │  → vector [0.12, -0.34, ...]
        └──────────────────────┘
                    │
                    ▼
        ┌──────────────────────┐
        │ 2. Tìm chunks gần   │  pgvector cosine similarity
        │    nhất trong DB     │  → top 5 chunks liên quan
        └──────────────────────┘
                    │
                    ▼
        ┌──────────────────────┐
        │ 3. Gửi prompt + chunks│ Groq API (Llama 3.3 70B)
        │    cho LLM           │  "Dựa vào nội dung khóa học..."
        └──────────────────────┘
                    │
                    ▼
        Student nhận câu trả lời dựa trên nội dung khóa học
```

Đây gọi là **RAG — Retrieval-Augmented Generation**:

- **Retrieval**: Tìm kiếm context liên quan (pgvector)
- **Augmented**: Bổ sung context vào prompt
- **Generation**: LLM sinh câu trả lời

---

## 5. DOCKER COMPOSE — THAY ĐỔI CHI TIẾT

### 5.1 Trước vs Sau

```diff
services:
  postgres:
-   image: postgres:16-alpine
+   image: pgvector/pgvector:pg16
    container_name: sslm-postgres
    # ... phần còn lại giữ nguyên
```

### 5.2 Tại sao không dùng `pgvector/pgvector:pg16-alpine`?

Image `pgvector/pgvector:pg16` dựa trên Debian (không phải Alpine) vì:

- pgvector cần compile từ source → Alpine thiếu một số build tools
- Official pgvector image chỉ publish bản Debian
- Size lớn hơn Alpine (~150MB vs ~80MB) nhưng ổn định hơn

### 5.3 Restart containers sau khi đổi image

```bash
docker compose down       # Stop và remove containers cũ
docker compose up -d      # Pull image mới + start containers
```

> **Lưu ý:** Data PostgreSQL được lưu trong volume `pgdata`, nên data **không bị mất** khi đổi image. Tuy nhiên nếu đổi major version (ví dụ PostgreSQL 16 → 17) thì cần migrate data.

### 5.4 Verify pgvector hoạt động

```bash
docker exec sslm-postgres psql -U sslm_user -d sslm_dev \
  -c "CREATE EXTENSION IF NOT EXISTS vector;"
# Output: CREATE EXTENSION

docker exec sslm-postgres psql -U sslm_user -d sslm_dev \
  -c "SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';"
# Output: vector | 0.8.0
```
