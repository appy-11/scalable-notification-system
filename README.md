# Scalable Notification System

A production-oriented, scalable notification service designed to reliably deliver notifications across multiple channels while handling asynchronous processing, retries, idempotency, templates, and high-throughput workloads.

The project demonstrates backend system-design concepts such as **event-driven processing, message queues, idempotent APIs, background workers, retry mechanisms, caching, and horizontal scalability**.

---

## 🚀 Overview

The Scalable Notification System provides a centralized service for applications to send notifications to users through different communication channels.

Instead of processing notification delivery synchronously inside the API request, the system uses **Redis + BullMQ** to enqueue notification jobs and process them asynchronously through dedicated workers.

### High-level flow

```text
                    ┌─────────────────┐
                    │     Client      │
                    │  / API Consumer │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │   Fastify API   │
                    │                 │
                    │ Validation      │
                    │ Idempotency     │
                    │ Business Logic  │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │    PostgreSQL   │
                    │                 │
                    │ Users           │
                    │ Templates       │
                    │ Notifications   │
                    └─────────────────┘
                             │
                             │ Enqueue Job
                             ▼
                    ┌─────────────────┐
                    │      Redis      │
                    │     BullMQ      │
                    │                 │
                    │    Job Queue    │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │ Notification    │
                    │    Worker(s)    │
                    │                 │
                    │ Process Job     │
                    │ Retry Failed   │
                    │ Update Status  │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │ Notification    │
                    │   Provider(s)   │
                    │ Email / Push /  │
                    │ SMS / etc.      │
                    └─────────────────┘
```

---

# ✨ Features

### Multi-channel notification architecture

The system is designed around notification channels so that additional providers can be introduced without changing the core notification workflow.

Examples:

- Email
- Push notifications
- SMS
- Other custom channels

---

### Asynchronous processing

Notification delivery is handled asynchronously using **BullMQ**.

The API does not need to wait for the external notification provider to complete before responding to the client.

```text
API Request
    │
    ▼
Create Notification
    │
    ▼
Add Job to Queue
    │
    ▼
Return Response
    │
    └──────────────► Worker processes notification
```

This improves API responsiveness and allows notification processing to scale independently.

---

### Idempotency

The system supports idempotent notification requests to prevent duplicate processing when clients retry requests.

This is particularly important when:

- A client times out and retries.
- A network failure occurs after the server has processed a request.
- Multiple requests are accidentally submitted with the same idempotency key.

Conceptually:

```text
Request
   │
   ├── idempotency key
   │
   ▼
Check existing request
   │
   ├── Exists → Return existing result
   │
   └── Doesn't exist
           │
           ▼
      Process request
```

This ensures that retrying the same logical operation does not unintentionally create duplicate notifications.

---

### Retry handling

Transient notification failures should not immediately result in permanent failure.

BullMQ provides job retry capabilities that allow failed notification jobs to be retried.

```text
Notification Job
      │
      ▼
   Attempt
      │
 ┌────┴─────┐
 │          │
Success    Failure
 │          │
 ▼          ▼
Complete   Retry
             │
             ▼
          Attempt N
```

Permanent failures can eventually be marked as failed after the configured retry policy is exhausted.

---

### Notification status tracking

Notification state can be persisted so that the lifecycle of a notification can be observed.

Example lifecycle:

```text
PENDING
   │
   ▼
QUEUED
   │
   ▼
PROCESSING
   │
   ├──────────────► SENT
   │
   └──────────────► FAILED
```

This provides visibility into notification processing and makes the system easier to monitor and debug.

---

### Template management

Notifications are separated from their presentation through reusable templates.

The data model supports:

- Templates
- Template versions
- Notification categories
- Notification channels

This allows notification content to evolve without tightly coupling message content to application code.

Example:

```text
Template
   │
   ├── Version 1
   ├── Version 2
   └── Version 3
```

Versioning also makes it possible to preserve historical template definitions.

---

# 🏗️ Architecture

The application follows a modular backend architecture.

```text
src/
│
├── modules/
│   ├── notification/
│   ├── template/
│   └── user/
│
├── queues/
│   └── notification.queue
│
├── workers/
│   └── notification.worker
│
├── plugins/
│
├── config/
│
├── utils/
│
├── app.ts
└── server.ts
```

The exact project structure may evolve as additional modules are introduced.

---

# 🛠️ Tech Stack

| Technology     | Purpose                                   |
| -------------- | ----------------------------------------- |
| **Node.js**    | Runtime                                   |
| **TypeScript** | Type-safe application development         |
| **Fastify**    | HTTP API framework                        |
| **PostgreSQL** | Persistent relational data                |
| **Prisma**     | ORM and database access                   |
| **Redis**      | Queue backend / fast in-memory operations |
| **BullMQ**     | Background job processing                 |
| **Docker**     | Local infrastructure                      |
| **ESLint**     | Code quality                              |
| **Prettier**   | Code formatting                           |

---

# 🗄️ Data Model

The initial data model includes entities such as:

```text
User
 │
 └──────────────┐
                │
                ▼
          Notification
                │
        ┌───────┴────────┐
        │                │
        ▼                ▼
     Channel         Category


Template
   │
   └── TemplateVersion
```

Core concepts include:

### User

Represents a notification recipient.

Potential recipient information includes:

- User identity
- Contact information
- Notification preferences

---

### Notification

Represents an individual notification request.

Typical information includes:

- Recipient
- Channel
- Category
- Template
- Status
- Idempotency information
- Processing timestamps

---

### Template

Represents reusable notification content.

---

### TemplateVersion

Stores individual versions of a notification template.

This allows templates to evolve while maintaining historical versions.

---

### NotificationChannel

Defines the supported delivery mechanisms.

---

### NotificationCategory

Groups notifications according to their business purpose.

For example:

```text
ACCOUNT
TRANSACTION
SECURITY
MARKETING
SYSTEM
```

---

### NotificationStatus

Represents the current processing state of a notification.

For example:

```text
PENDING
QUEUED
PROCESSING
SENT
FAILED
```

---

# 🔄 Notification Processing Flow

A typical notification request follows this lifecycle:

### 1. Client sends request

```http
POST /notifications
```

The request contains the recipient, channel, template/category information and an idempotency key where applicable.

---

### 2. API validates request

Fastify validates the incoming request before business logic is executed.

---

### 3. Idempotency check

The system checks whether the request has already been processed using its idempotency identifier.

```text
Idempotency Key
       │
       ▼
Existing request?
   │          │
  Yes         No
   │           │
   ▼           ▼
Return       Create
existing     notification
result          │
                ▼
             Queue job
```

---

### 4. Notification persisted

The notification request is stored in PostgreSQL.

---

### 5. Job added to BullMQ

The notification is converted into an asynchronous job and added to the Redis-backed queue.

---

### 6. Worker processes job

A notification worker consumes jobs from the queue.

```text
Redis
  │
  ▼
BullMQ
  │
  ▼
Worker
  │
  ├── Resolve template
  ├── Build notification
  ├── Call provider
  └── Update status
```

---

### 7. Status updated

After successful delivery:

```text
PROCESSING → SENT
```

If delivery fails:

```text
PROCESSING → FAILED
```

or the job can be retried according to the configured retry policy.

---

# 🔐 Idempotency Design

Idempotency is one of the important reliability mechanisms in this project.

Without idempotency, a client retry could result in:

```text
Request #1 → Notification A
Request #2 → Notification B
```

even though both requests represent the same logical operation.

With idempotency:

```text
Request #1
   │
   ▼
Key: abc123
   │
   ▼
Notification created
```

A retry:

```text
Request #2
   │
   ▼
Key: abc123
   │
   ▼
Existing operation found
   │
   ▼
Return existing result
```

This makes the API safe to retry.

---

# 📬 Queue Architecture

BullMQ is used as the asynchronous processing layer.

```text
                    ┌───────────────┐
                    │   Fastify API │
                    └───────┬───────┘
                            │
                            ▼
                     ┌────────────┐
                     │ BullMQ     │
                     │ Queue      │
                     └─────┬──────┘
                           │
                  ┌────────┴────────┐
                  ▼                 ▼
             Worker 1          Worker 2
                  │                 │
                  └────────┬────────┘
                           ▼
                    Notification
                     Providers
```

This architecture allows workers to be scaled independently from the API.

For example:

```text
1 API instance
        +
5 notification workers
```

can later become:

```text
3 API instances
        +
20 notification workers
```

without fundamentally changing the notification API.

---

# 📈 Scalability Considerations

The system is designed with horizontal scalability in mind.

### Stateless API

The API layer should remain stateless so that multiple instances can run behind a load balancer.

```text
             Load Balancer
             /     |     \
            /      |      \
         API-1   API-2   API-3
            \      |      /
             \     |     /
               Redis
                 │
              PostgreSQL
```

---

### Independent worker scaling

Notification workers can be scaled independently based on queue depth.

```text
Queue depth increases
        │
        ▼
Add worker instances
        │
        ▼
Higher processing throughput
```

---

### Redis-backed queues

Redis provides a fast intermediary between API requests and background workers.

The queue decouples request processing from notification delivery.

---

### PostgreSQL

PostgreSQL provides durable persistence for:

- Users
- Notifications
- Templates
- Template versions
- Notification metadata

Indexes should be introduced around high-frequency access patterns such as:

- Idempotency keys
- User IDs
- Notification status
- Created timestamps

---

# 🐳 Running Locally

## Prerequisites

Make sure the following are installed:

- Node.js
- Docker
- Docker Compose
- npm

---

## 1. Clone the repository

```bash
git clone <repository-url>

cd scalable-notification-system
```

---

## 2. Install dependencies

```bash
npm install
```

---

## 3. Start infrastructure

Start PostgreSQL and Redis using Docker Compose:

```bash
docker compose up -d
```

Verify the containers:

```bash
docker compose ps
```

---

## 4. Configure environment variables

Create a `.env` file:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/notification_db"

REDIS_HOST="localhost"
REDIS_PORT=6379

PORT=3000
```

Use the actual values defined by the project configuration if they differ.

---

## 5. Run Prisma migrations

```bash
npx prisma migrate dev
```

Generate the Prisma client:

```bash
npx prisma generate
```

---

## 6. Start the API

Development mode:

```bash
npm run dev
```

The API should now be available at:

```text
http://localhost:3000
```

---

## 7. Start the worker

Run the notification worker separately:

```bash
npm run worker
```

The worker will consume notification jobs from BullMQ.

---

# 🔌 API

The API is designed around notification-oriented resources.

### Create Notification

```http
POST /notifications
```

Example request:

```json
{
  "userId": "user-id",
  "channel": "EMAIL",
  "category": "TRANSACTION",
  "templateId": "template-id"
}
```

---

### Idempotent Request

A request can include an idempotency key:

```http
Idempotency-Key: 8f5a3c2d-...
```

Repeated requests with the same key should not create duplicate notification operations.

---

# 🧪 Testing

The system can be tested using tools such as:

- Postman
- curl
- Automated integration tests

Example:

```bash
curl -X POST http://localhost:3000/notifications \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: test-request-001" \
  -d '{
    "userId": "user-id",
    "channel": "EMAIL",
    "category": "TRANSACTION",
    "templateId": "template-id"
  }'
```

A repeated request using the same idempotency key should not create another logical notification.

---

# 📊 Observability

For a production deployment, the following metrics would be useful:

### API

- Request rate
- Error rate
- Response latency
- Requests by endpoint

### Queue

- Queue depth
- Job processing rate
- Failed jobs
- Retry count
- Processing latency

### Notifications

- Notifications sent
- Notifications failed
- Delivery latency
- Failure rate by channel/provider

These metrics can help identify bottlenecks and capacity issues.

---

# ⚠️ Failure Scenarios

The architecture considers several common failure cases.

### API failure

If the API instance fails after a request has been accepted, persisted notification state and idempotency mechanisms help prevent duplicate logical requests.

---

### Worker failure

If a worker crashes while processing a job, BullMQ can manage job recovery/retry according to its configured processing semantics.

---

### Provider failure

Temporary provider failures can be handled through retries.

```text
Provider
   │
   ├── Success → SENT
   │
   └── Temporary failure
              │
              ▼
            Retry
              │
              ▼
        Retry exhausted
              │
              ▼
            FAILED
```

---

### Redis unavailable

Redis is part of the asynchronous processing path, so production deployments should consider:

- Redis availability
- Persistence/recovery strategy
- Connection monitoring
- Queue backpressure

---

# 🧠 System Design Decisions

### Why asynchronous processing?

Notification delivery is typically I/O-heavy and can involve external providers.

Keeping it outside the synchronous API request:

- Reduces API latency
- Prevents provider latency from blocking requests
- Enables independent worker scaling
- Provides retry capabilities

---

### Why BullMQ?

BullMQ provides a Redis-backed job processing abstraction with features useful for notification workloads, including:

- Background processing
- Retries
- Delayed jobs
- Job state management
- Worker concurrency

---

### Why PostgreSQL?

The notification domain has strongly related entities such as users, templates, template versions, categories, and notification records.

A relational database provides:

- Strong consistency
- Transactions
- Relationships
- Indexing
- Reliable persistence

---

### Why Redis?

Redis serves as the fast, distributed coordination layer for asynchronous jobs through BullMQ.

It also leaves room for future capabilities such as:

- Rate limiting
- Caching
- Distributed locks

---

# 🔮 Future Improvements

Potential extensions include:

- [ ] Email provider integration
- [ ] SMS provider integration
- [ ] Push notification provider
- [ ] User notification preferences
- [ ] Scheduled notifications
- [ ] Notification batching
- [ ] Dead-letter queue
- [ ] Rate limiting
- [ ] Provider fallback
- [ ] Exponential backoff
- [ ] Notification dashboard
- [ ] Metrics and monitoring
- [ ] OpenTelemetry tracing
- [ ] Prometheus/Grafana integration
- [ ] Kubernetes deployment
- [ ] Horizontal worker autoscaling

---

# 🎯 What This Project Demonstrates

This project is intended to demonstrate practical backend and system-design concepts:

- REST API design
- Fastify
- TypeScript
- Prisma
- PostgreSQL
- Redis
- BullMQ
- Event-driven architecture
- Asynchronous processing
- Idempotency
- Retry mechanisms
- Worker-based architecture
- Database modeling
- Transactional thinking
- Failure handling
- Horizontal scalability
- Production-oriented system design

---

# 📌 Project Status

🚧 **Active development**

The core notification workflow, database layer, queue architecture, worker processing, and idempotency mechanisms are being developed incrementally.

---

## 👨‍💻 Author

**Apoorva Sharma**

Software Engineer | Full Stack / Frontend

GitHub: [github.com/appy-11](https://github.com/appy-11)

---

## ⭐ If you find this project useful

Feel free to explore the architecture, raise issues, or suggest improvements.
