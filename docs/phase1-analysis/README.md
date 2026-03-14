# Phase 1: Phân tích yêu cầu — Smart Social Learning Marketplace

## Kiến trúc

- **2 Web App**: Student Portal + Management Portal (Instructor/Admin)
- **1 Shared Backend API** (NestJS)
- **100% Free Tier** ($0/tháng)

## Tài liệu (4 files)

| #   | File                                                                       | Nội dung                                                                                                                       |
| --- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| 1   | [01-actors-and-use-cases.md](01-actors-and-use-cases.md)                   | Actors, kiến trúc 2 portal, ma trận quyền hạn + **35 Use Cases** với implementation chi tiết (diagrams, API, code, edge cases) |
| 2   | [02-requirements.md](02-requirements.md)                                   | **69 Functional Requirements** (MoSCoW) + **30 Non-functional Requirements** (Performance, Security, Scalability...)           |
| 3   | [03-recommendation-system.md](03-recommendation-system.md)                 | Hệ gợi ý thuật toán: Cosine Similarity + Jaccard + Wilson Score, Hybrid weighted, Smart Chapter Suggestion                     |
| 4   | [04-tech-stack-and-implementation.md](04-tech-stack-and-implementation.md) | Full tech stack $0/month + Implementation chi tiết: Cloudinary (video), SePay (payment), Groq (AI), Redis/DB optimization      |

## Tech Stack (100% Free)

| Layer    | Technology                  | Service                 |
| -------- | --------------------------- | ----------------------- |
| Frontend | Next.js + Tailwind + Shadcn | Vercel                  |
| Backend  | NestJS + Prisma + Socket.io | Render.com              |
| Database | PostgreSQL + pgvector       | Neon.tech               |
| Cache    | Redis                       | Upstash                 |
| Media    | Video + Image + CDN         | Cloudinary              |
| AI       | Llama 3.3 70B + RAG         | Groq                    |
| Payment  | QR bank transfer + webhook  | SePay                   |
| Email    | Transactional emails        | Gmail SMTP (Nodemailer) |
