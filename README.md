# 📺 StreamLive

![Live Demo](https://img.shields.io/badge/demo-online-brightgreen) [![GitHub](https://img.shields.io/badge/GitHub-repo-blue)](https://github.com/your-username/streaming-app)

A full-stack live streaming platform with RTMP ingest, HLS playback, real-time chat, and role-based access control — built with Next.js 14 (App Router), Express.js, and MongoDB.

---

## 🛠️ Tech Stack

| Layer      | Technology                                                                                  |
| ---------- | ------------------------------------------------------------------------------------------- |
| Framework  | Next.js 14 (App Router), React 18                                                           |
| Frontend   | React 18, hls.js, CSS Variables                                                             |
| Backend    | Node.js, Express.js                                                                         |
| Runtime    | Node.js 18+                                                                                 |
| Database   | MongoDB, Mongoose ODM                                                                       |
| Auth       | JWT (httpOnly cookie + Bearer token), bcryptjs                                              |
| Storage    | Local filesystem (HLS segments in MEDIA_ROOT)                                               |
| Validation | Custom sanitization utilities, express-rate-limit                                           |
| Caching    | Simple in-memory cache (TTL + LRU eviction)                                                 |
| UI Extras  | Custom UI components, CSS variables, dark theme                                             |
| Tools      | node-media-server (RTMP), FFmpeg (HLS transcode), ws (WebSocket), helmet, compression, cors |

---

## ✨ Features Overview

- **Role-based authentication** with viewer, streamer, and admin roles
- **JWT-based auth** stored in httpOnly cookies with 7-day expiration
- **RTMP ingest** via OBS with automatic FFmpeg transcoding to HLS
- **HLS playback** using hls.js with Safari native fallback
- **Real-time live chat** per stream room via WebSocket with authentication
- **Streamer dashboard** — create streams, manage active stream, view history, reset stream key
- **Stream discovery** — search streams by text, filter by category, pagination
- **Engagement features** — comments (with pagination), likes, view tracking
- **Live viewer count** tracked via join/leave beacon endpoints
- **SEO optimization** — auto-generated sitemap.xml, robots.txt
- **Rate limiting** on auth endpoints (10 req/15min in production)
- **Input sanitization** for XSS prevention on all user inputs
- **Graceful shutdown** handling for HTTP, WebSocket, RTMP, and MongoDB connections
- **Request logging** with request IDs and slow request warnings

---

## 📁 Project Structure

```
src/
├── app/                                    # Next.js App Router pages
│   ├── dashboard/
│   │   └── page.js                         # Streamer studio (go live, manage, history, settings)
│   ├── login/
│   │   └── page.js                         # Login page
│   ├── register/
│   │   └── page.js                         # Registration page
│   ├── watch/[slug]/
│   │   └── WatchClient.jsx                 # HLS player + comments + live chat
│   ├── HomeClient.jsx                      # Stream grid with search, filter, pagination
│   ├── layout.jsx                          # Root layout with Navbar
│   ├── page.jsx                            # Home page
│   ├── favicon.ico                         # Site favicon
│   └── fonts/                              # Custom fonts
│
├── components/                             # Reusable React components
│   ├── ChatBox.jsx                         # WebSocket live chat with auto-reconnect
│   ├── ErrorBoundary.jsx                   # React error boundary wrapper
│   ├── Navbar.jsx                          # Sticky navbar with auth state
│   ├── Ui.jsx                              # Shared UI primitives (Avatar, Spinner, Tag, Card)
│   ├── VideoCard.jsx                       # Stream card with thumbnail and viewer count
│   └── VideoPlayer.jsx                     # HLS player (hls.js + Safari native fallback)
│
├── hooks/                                  # Custom React hooks
│   └── useAuth.js                          # Auth context, JWT storage, axios header injection
│
├── server/                                 # Express backend
│   ├── middleware/
│   │   └── auth.js                         # JWT verification + role guard (protect, streamerOnly)
│   ├── models/                             # Mongoose schemas
│   │   ├── User.js                         # User schema (bcrypt, streamKey generation, followers/following)
│   │   ├── Video.js                        # Video schema (slug, comments, text index, search methods)
│   │   └── Comment.js                      # Comment schema with pagination helper
│   ├── routes/                             # Express API routes
│   │   ├── auth.js                         # Register, login, get/update profile, logout
│   │   ├── videos.js                       # CRUD streams, comments, likes, viewer tracking
│   │   ├── stream.js                       # Stream key management, status check
│   │   └── seo.js                          # Sitemap + robots.txt generation
│   ├── utils/                              # Utility functions
│   │   ├── sanitize.js                     # Input sanitization (text, tags, username)
│   │   └── validateEnv.js                  # Environment variable validation
│   ├── db.js                               # MongoDB connection with auto-reconnect logic
│   └── mediaServer.js                      # RTMP → FFmpeg → HLS pipeline with session tracking
│
└── styles/                                 # Global styles
    └── global.css                          # Design system (CSS variables, dark theme)

server.js                                   # Entry point — Express + Next.js + WebSocket + RTMP + graceful shutdown
```

---

## 🗃️ Database Schema

| Model   | Description                                                                                                                                                                                                                                                                                                                                 |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User    | User accounts with authentication, roles, stream keys, and social features (followers/following). Key fields: username (unique), email (unique), passwordHash (bcrypt), role (viewer/streamer/admin), streamKey (sparse unique), avatar, followers[], following[], isActive                                                                 |
| Video   | Stream/video metadata with engagement tracking. Key fields: title, description, streamer (ref), hlsUrl, thumbnail, category (enum), tags[], status (live/ended/scheduled), viewerCount, totalViews, likes, likedBy[], commentsCount, slug (auto-generated), metaDescription, startedAt, endedAt. Text index on title/description for search |
| Comment | Comments on videos with pagination support. Key fields: video (ref), user (ref), text (max 300 chars), likes. Compound index on video+createdAt for efficient queries                                                                                                                                                                       |

---

## 🔄 System Flow

## 01 · Authentication

```
User → Register/Login → JWT Token → httpOnly Cookie + Response Body → Protected Routes
```

- **Users can**: Register new accounts (viewer or streamer role), login with email/password, logout, update username/avatar
- **Roles**: `viewer` (default), `streamer` (can create streams), `admin` (full access)
- **JWT**: 7-day expiration, stored in httpOnly cookie (secure in production), also returned in response body for backward compatibility
- **Rate limiting**: 10 requests per 15 minutes on auth endpoints in production (1000 in development)

| Role     | Permissions                                                      |
| -------- | ---------------------------------------------------------------- |
| viewer   | View streams, comment, like                                      |
| streamer | All viewer permissions + create/manage streams, reset stream key |
| admin    | All permissions                                                  |

## 02 · Customer Flow

```
Home → Browse Streams (filter/search) → Watch Stream → HLS Playback → Live Chat
```

- **Viewers can**: Browse live streams by category, search streams by text, watch HLS streams, send chat messages (authenticated), like streams, add comments, view stream details
- **Stream discovery**: Filter by category (gaming, music, education, sports, lifestyle, other), text search with MongoDB text index, pagination
- **View tracking**: Cookie-based deduplication (1-hour expiry), excludes bots/crawlers

## 03 · Streamer Flow

```
Dashboard → Create Stream → OBS (RTMP) → FFmpeg Transcode → HLS Files → Viewers Watch
```

- **Streamers can**: Create new streams (title, description, category, tags), start streaming via OBS with stream key, manage active stream (update info, end stream), reset stream key (kills active stream), view stream history
- **RTMP ingest**: Port 1935 (configurable), authenticated by streamKey
- **HLS output**: FFmpeg transcodes to .m3u8 + .ts segments, stored in MEDIA_ROOT/live/{streamKey}/
- **Stream key**: Auto-generated on registration (sk\_{random}), can be reset via dashboard

| Stream Status | Description             |
| ------------- | ----------------------- |
| live          | Currently broadcasting  |
| ended         | Stream has ended        |
| scheduled     | Reserved for future use |

## 04 · Real-time Chat

```
Viewer → WebSocket /chat/:videoId → Broadcast to all clients in room
```

- **Chat features**: Per-stream rooms, authentication required (JWT from cookie), message limits (30 chars username, 200 chars text), auto-reconnect on disconnect
- **WebSocket**: ws://host:port/chat/{videoId}, JWT verification via cookie

---

## � Caching Strategy

| Tag Pattern | Scope             | Revalidated On                          |
| ----------- | ----------------- | --------------------------------------- |
| `.*`        | All video queries | Video creation, update, like operations |

**Implementation**: Simple in-memory cache (SimpleCache class) with 5-second TTL, 100-entry max, LRU eviction. Cache key derived from query parameters. Cache status returned in `x-cache` header (HIT/MISS).

---

## 🔐 Security

- **JWT authentication**: Tokens stored in httpOnly cookies (secure in production), 7-day expiration, Bearer token fallback for API clients
- **Password hashing**: bcrypt with salt rounds of 12
- **Role-based access control (RBAC)**: Middleware enforces streamer-only routes
- **Input sanitization**: Custom utilities escape HTML entities, validate usernames (alphanumeric + underscore), sanitize tags array
- **Rate limiting**: express-rate-limit on auth endpoints (10 req/15min production), viewer beacon (5 req/min), comments (10 req/min)
- **CORS**: Configurable allowed origins, credentials enabled
- **Helmet**: Content Security Policy with mediaSrc for HLS, cross-origin resource policy
- **Environment validation**: Required fields checked at startup, JWT_SECRET must be ≥32 characters
- **Request logging**: Request IDs, slow request warnings (>1s), error logging with stack traces in development
- **Graceful shutdown**: Handles SIGTERM/SIGINT, closes HTTP server, WebSocket connections, RTMP server, MongoDB connection

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- MongoDB (local or Atlas)
- FFmpeg (for HLS transcoding)

### Installation

```bash
git clone https://github.com/your-username/streaming-app.git
cd streaming-app
npm install
```

### Environment Variables

Create a `.env.local` file in the root:

```env
PORT=3001
NODE_ENV=production

MONGO_URI=mongodb+srv://admin:StrongPassword@cluster0.xxxxx.mongodb.net/streaming-app

JWT_SECRET=4c7f1f98c6d14e0b91d0c0f4f2e4a9b8f6d1f7e8c9a0b1c2d3e4f5a6b7c8d9

ALLOWED_ORIGINS=https://streamlive.com,https://www.streamlive.com

SITE_URL=https://streamlive.com

HLS_ORIGIN=https://streamlive.com

MEDIA_ROOT=/var/www/media

RTMP_PORT=1935
HLS_PORT=8888

FFMPEG_PATH=/usr/bin/ffmpeg

NEXT_PUBLIC_WS_PORT=3001
```

### Run

```bash
# Development
npm run dev

# Production build
npm run build
npm start
```

---

## 👤 Author

**Your Name**  
Full Stack Developer (Next.js, Express, MongoDB)  
📧 patsarun2545@gmail.com  
🔗 [github.com/your-username](https://github.com/your-username)
