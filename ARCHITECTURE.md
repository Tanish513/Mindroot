# Mindroot ("Student to Student") Architecture & System Map

> **Developer Maintenance Rule**: This file is the single source of truth for the Mindroot platform's software architecture, database schema, WebRTC signaling workflows, API contracts, and codebase directory layout. Whenever you make architectural changes, add new API endpoints, or modify data models, you MUST update this file accordingly.

---

## 1. High-Level Architecture Overview

```mermaid
flowchart TD
    subgraph Client["React 18 Frontend (Vite)"]
        UI["UI Pages & Router<br/>(Dashboard, LiveRoom, Schedule, AdminPortal)"]
        Env["LAN Auto-Detection<br/>(src/lib/env.ts)"]
        APIClient["API & Socket Client<br/>(src/lib/api/index.ts)"]
        RTC["WebRTC Video Engine<br/>(SimplePeer / MediaStream)"]
    end

    subgraph Server["Node.js Express + Socket.io Server"]
        AuthMiddleware["JWT Auth Middleware<br/>(req.userId & req.userRole)"]
        REST["REST API Endpoints<br/>(/api/users, /api/sessions, /api/peers)"]
        Signaling["Socket.io Real-Time Server<br/>(user:<userId> Scoped Rooms)"]
        TurnAPI["STUN/TURN Credential API<br/>(/api/turn-credentials)"]
    end

    subgraph DataLayer["Dual Data Persistence Layer"]
        Prisma["Prisma ORM<br/>(server/prisma/schema.prisma)"]
        Postgres[(PostgreSQL Database)]
        JSONFallback["inMemoryUsers & db.json<br/>(Instant Dev/Multi-Laptop Sync)"]
    end

    UI --> APIClient
    Env --> APIClient
    APIClient -- HTTP REST Requests --> AuthMiddleware
    AuthMiddleware --> REST
    APIClient -- WebSocket Signaling --> Signaling
    RTC <== Direct P2P Video/Audio Stream ==> RTC
    Signaling -- Relay Offers/Answers --> RTC
    TurnAPI -- ICE Credentials --> RTC
    REST --> Prisma
    Prisma --> Postgres
    REST -- Sync Fallback --> JSONFallback
```

---

## 2. Database Entity-Relationship Diagram (ERD)

```mermaid
erDiagram
    User ||--o{ Session : "teaches (TeacherSessions)"
    User ||--o{ Session : "learns (StudentSessions)"
    User ||--o{ UserSkill : "has userSkills"
    User ||--o{ Transaction : "executes"
    User ||--o{ Message : "sends / receives"
    User ||--o{ Review : "writes / receives"
    User ||--o{ EmailVerificationToken : "owns"
    User ||--o{ PasswordResetToken : "owns"
    Skill ||--o{ UserSkill : "referenced in"

    User {
        string id PK
        string name
        string email UK
        string password "Bcrypt Hash"
        boolean emailVerified
        string role "student | teacher | admin | both"
        int tokenBalance
        float trustScore
    }

    Session {
        string id PK
        string title
        string teacherId FK
        string studentId FK
        string status "pending | confirmed | completed | live"
        string paymentStatus "pending | paid | partially_paid"
        int pricePerStudent
        int maxCapacity
        json students
        datetime scheduledAt
        int durationMin
    }

    Skill {
        string id PK
        string name
        string category
    }

    UserSkill {
        string id PK
        string userId FK
        string skillId FK
        string type "teaches | wants_to_learn"
    }

    Transaction {
        string id PK
        string userId FK
        string sessionId FK
        int amount
        string type "EARNED | SPENT"
        string status "paid"
        datetime createdAt
    }

    Message {
        string id PK
        string senderId FK
        string receiverId FK
        string text
        datetime createdAt
    }

    Review {
        string id PK
        string authorId FK
        string targetId FK
        string topic
        int rating
        string quote
        string[] chips
    }

    EmailVerificationToken {
        string id PK
        string userId FK
        string tokenHash UK
        datetime expiresAt
    }

    PasswordResetToken {
        string id PK
        string userId FK
        string tokenHash UK
        datetime expiresAt
        datetime usedAt
    }
```

---

## 3. WebRTC Signaling & Socket.io Room Sequence Diagram

```mermaid
sequenceDiagram
    autonumber
    participant Student as Student Peer (Client A)
    participant Server as Socket.io Backend Server
    participant Teacher as Teacher Peer (Client B)

    Note over Student,Teacher: 1. Room Initialization & Scoped Join
    Student->>Server: Connect Socket + Join Room ("user:studentId")
    Teacher->>Server: Connect Socket + Join Room ("user:teacherId")

    Note over Student,Teacher: 2. Session Approval & Targeted Broadcast
    Teacher->>Server: PATCH /api/sessions/:id (status: "confirmed")
    Server->>Server: Verify caller is session teacher
    Server->>Student: Emit to "user:studentId" -> session-updated (confirmed)
    Server->>Teacher: Emit to "user:teacherId" -> session-updated (confirmed)

    Note over Student,Teacher: 3. WebRTC P2P Video Connection
    Student->>Server: Emit signal (Offer SDP) -> target: teacherId
    Server->>Teacher: Relay signal (Offer SDP) -> to "user:teacherId"
    Teacher->>Server: Emit signal (Answer SDP) -> target: studentId
    Server->>Student: Relay signal (Answer SDP) -> to "user:studentId"
    Student->>Teacher: Exchange ICE Candidates via STUN/TURN
    Note over Student,Teacher: WebRTC Direct Media Stream Established 🎥
```

---

## 4. Codebase Directory Structure & Responsibilities Map

```
c:/Users/tanis/Downloads/hackton/Student to Student/
├── server/                              # Express & Socket.io Backend Application
│   ├── src/
│   │   ├── index.ts                     # Main server entry: REST API, Socket.io signaling, JWT middleware
│   │   └── lib/
│   │       └── email.ts                 # Resend & Nodemailer transaction email service
│   ├── prisma/
│   │   ├── schema.prisma                # PostgreSQL data models, indexes & relations
│   │   └── seed.ts                      # Development database seeding script
│   ├── db.json                          # In-memory JSON fallback persistence
│   └── package.json                     # Server dependencies
│
├── src/                                 # React 18 Frontend Application (Vite)
│   ├── pages/                           # Application Page Views
│   │   ├── AdminPortal.tsx              # User management & session oversight dashboard
│   │   ├── Dashboard.tsx                # Main student/teacher overview dashboard
│   │   ├── Feedback.tsx                 # Reviews & star ratings interface
│   │   ├── ForgotPassword.tsx           # Password reset request form
│   │   ├── LiveRoom.tsx                 # WebRTC P2P video classroom & whiteboard
│   │   ├── Login.tsx                    # Credential & Google OAuth authentication
│   │   ├── Marketplace.tsx              # Skill discovery & peer finding
│   │   ├── MatchFinder.tsx              # AI skill matching engine
│   │   ├── Messages.tsx                 # Direct 1-on-1 messaging interface
│   │   ├── Profile.tsx                  # Skill matrix & user settings
│   │   ├── ResetPassword.tsx            # Password reset token confirmation form
│   │   ├── Schedule.tsx                 # Booking, teacher approval & .ics calendar
│   │   ├── TeacherPortal.tsx            # Session requests & teaching management
│   │   ├── VerifyEmail.tsx              # Email verification handler
│   │   └── Wallet.tsx                   # Skill tokens, transactions & payouts
│   ├── components/                      # UI Components
│   │   ├── ErrorBoundary.tsx            # React runtime exception wrapper
│   │   ├── NotificationManager.tsx      # Real-time toast notifications
│   │   └── ui/                          # Design system components
│   ├── lib/
│   │   ├── api/index.ts                 # API client, REST endpoints & Socket listeners
│   │   └── env.ts                       # Dynamic LAN IP origin auto-detection
│   ├── App.tsx                          # App router & layout shell
│   └── main.tsx                         # React DOM entry point
│
└── package.json                         # Frontend dependencies
```

---

## 5. API Endpoint Summary

| Category | Endpoint | Method | Description |
| :--- | :--- | :--- | :--- |
| **Auth** | `/api/auth/register` | `POST` | Registers a new user account with bcrypt password hashing. |
| **Auth** | `/api/auth/login` | `POST` | Authenticates credentials and returns a signed JWT Bearer token. |
| **Auth** | `/api/auth/google` | `POST` | Authenticates Google OAuth 2.0 idToken. |
| **Auth** | `/api/auth/verify-email` | `GET` | Verifies user email address via token. |
| **Auth** | `/api/auth/reset-password` | `POST` | Sets a new password via reset token. |
| **Users** | `/api/users/me` | `GET` | Returns authenticated user profile. |
| **Users** | `/api/peers` | `GET` | Returns public peer profiles excluding requesting user. |
| **Users** | `/api/users/:id` | `PATCH` | Admin-only user details update and password reset. |
| **Sessions** | `/api/sessions` | `GET` | Returns scoped sessions where caller is teacher or student. |
| **Sessions** | `/api/sessions` | `POST` | Books a new peer session (status: `pending`). |
| **Sessions** | `/api/sessions/:id` | `PATCH` | Updates session status (`pending` $\rightarrow$ `confirmed` $\rightarrow$ `completed` / `live`). |
| **Sessions** | `/api/sessions/:id/calendar.ics` | `GET` | Returns `.ics` VCALENDAR file for scoped participants. |
| **Messages**| `/api/messages` | `GET` / `POST` | Fetches and sends direct messages between peers. |
| **Reviews** | `/api/reviews` | `GET` / `POST` | Submits peer ratings and updates target user's `trustScore`. |
| **WebRTC** | `/api/turn-credentials` | `GET` | Serves STUN/TURN server credentials for WebRTC NAT traversal. |

---

## 6. Maintenance Checklist for Developers

When modifying the codebase:
- [ ] **Added a new API endpoint?** Update Section 5 (API Endpoint Summary) and Section 1 (Architecture Flow).
- [ ] **Modified Prisma schema?** Update Section 2 (Database ERD).
- [ ] **Created a new page or component?** Update Section 4 (Codebase Map).
- [ ] **Changed signaling logic or socket rooms?** Update Section 3 (WebRTC Sequence Diagram).
