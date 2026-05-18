# 📺 StreamLive

A full-stack live streaming platform with RTMP ingest, HLS playback, real-time chat, and a streamer dashboard — built with Next.js and Express.

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router), React 18 |
| Backend | Node.js, Express.js |
| Database | MongoDB, Mongoose ODM |
| Auth | JWT (Bearer Token), Context API |
| Streaming | Node-Media-Server (RTMP), FFmpeg (HLS transcode) |
| Real-time | WebSocket (ws) |
| SEO | Sitemap, robots.txt, Open Graph, JSON-LD |

---

## 📁 Project Structure

```
root/
├── src/
│   ├── app/                        # Next.js App Router pages
│   │   ├── dashboard/
│   │   │   └── page.js             # Streamer studio (go live, manage, history, settings)
│   │   ├── login/
│   │   │   └── page.js             # Login page
│   │   ├── register/
│   │   │   └── page.js             # Register page
│   │   ├── watch/[slug]/
│   │   │   ├── page.js             # SSR page with meta tags + JSON-LD
│   │   │   └── WatchClient.jsx     # HLS player + comments + live chat
│   │   ├── HomeClient.jsx          # Stream grid with search, filter, pagination
│   │   ├── layout.jsx              # Root layout with AuthProvider + Navbar
│   │   └── page.jsx                # Home page
│   │
│   ├── components/
│   │   ├── ChatBox.jsx             # WebSocket live chat with auto-reconnect
│   │   ├── Navbar.jsx              # Sticky navbar with auth state
│   │   ├── Ui.jsx                  # Shared UI primitives (Avatar, Spinner, Tag, Card)
│   │   ├── VideoCard.jsx           # Stream card with thumbnail and viewer count
│   │   └── VideoPlayer.jsx         # HLS player (hls.js + Safari native fallback)
│   │
│   ├── hooks/
│   │   └── useAuth.js              # Auth context, JWT storage, axios header injection
│   │
│   ├── server/
│   │   ├── middleware/
│   │   │   └── auth.js             # JWT verification + role guard
│   │   ├── models/
│   │   │   ├── User.js             # User schema (bcrypt, streamKey generation)
│   │   │   └── Video.js            # Video schema (slug, comments, text index)
│   │   ├── routes/
│   │   │   ├── auth.js             # Register, login, get/update profile
│   │   │   ├── videos.js           # CRUD streams, comments, likes
│   │   │   ├── stream.js           # Stream key management
│   │   │   └── seo.js              # Sitemap + robots.txt
│   │   ├── db.js                   # MongoDB connection with auto-reconnect
│   │   └── mediaServer.js          # RTMP → FFmpeg → HLS pipeline
│   │
│   └── styles/
│       └── global.css              # Design system (CSS variables, dark theme)
│
├── server.js                       # Entry point — Express + Next.js + WebSocket + RTMP
└── package.json
```

---

## ✨ Features

- JWT-based authentication with viewer and streamer roles
- RTMP ingest via OBS — transcoded to HLS with FFmpeg automatically
- Low-latency HLS playback with hls.js and Safari native fallback
- Real-time live chat per stream room via WebSocket with auto-reconnect
- Streamer dashboard — go live, manage stream, view history, reset stream key
- Search and filter streams by category with debounced input and pagination
- Comments and likes on each stream
- Live viewer count tracked via RTMP play/done events
- SSR meta tags, Open Graph, JSON-LD, sitemap.xml, and robots.txt for SEO
- Rate limiting on auth endpoints

---

## 🔐 Middleware

| Middleware | File | Responsibility |
|-----------|------|----------------|
| Auth | `auth.js` | Validates JWT from `Authorization: Bearer <token>` |
| Role Guard | `auth.js` | Restricts streamer-only routes (`streamerOnly`) |
| Rate Limiter | `express-rate-limit` | 10 requests / 15 min on auth endpoints in production |

---

## 🔄 API Reference

### Auth

```
POST  /api/auth/register   → Register a new account
POST  /api/auth/login      → Login and receive JWT token
GET   /api/auth/me         → Get current user
PATCH /api/auth/me         → Update username or avatar
```

### Videos

```
GET    /api/videos              → List live streams (filter by category, search, pagination)
POST   /api/videos              → Create a new stream (streamer only)
GET    /api/videos/:slug        → Get a single stream with comments
PATCH  /api/videos/:slug        → Update stream info or end stream
POST   /api/videos/:id/comments → Add a comment
POST   /api/videos/:id/like     → Like a stream
```

### Stream

```
GET   /api/stream/key              → Get stream key (streamer only)
POST  /api/stream/key/reset        → Reset stream key (streamer only)
GET   /api/stream/status/:key      → Check if a stream key is currently live
```

### SEO

```
GET   /sitemap.xml   → Auto-generated sitemap
GET   /robots.txt    → Robots directives
```

---

## 🗃️ Database Schema

```
User
├── id
├── username (unique)
├── email (unique)
├── passwordHash (bcrypt)
├── role          (viewer | streamer | admin)
├── streamKey     (streamer only, hidden by default)
├── avatar
├── followers[]
└── following[]

Video
├── id
├── title
├── description
├── slug          (auto-generated)
├── hlsUrl
├── thumbnail
├── category      (gaming | music | education | sports | lifestyle | other)
├── tags[]
├── status        (live | ended | scheduled)
├── viewerCount
├── totalViews
├── likes
├── comments[]
│   ├── user
│   ├── text
│   └── createdAt
├── metaDescription
├── startedAt
└── endedAt
```

---

## 🔄 Streaming Flow

```
Streamer  →  OBS (RTMP :1935)  →  FFmpeg transcode  →  HLS files (.m3u8 + .ts)
Viewer    →  /watch/[slug]     →  VideoPlayer        →  fetch .m3u8 (hls.js)
Chat      →  WebSocket /chat/:videoId  →  broadcast to all clients in room
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- MongoDB
- FFmpeg

### Installation

```bash
git clone https://github.com/your-username/streaming-app.git
cd streaming-app
npm install
```

### Environment Variables

Create a `.env.local` file in the root:

```env
MONGO_URI=mongodb://localhost:27017/streamlive
JWT_SECRET=your_jwt_secret_key
SITE_URL=http://localhost:3001
PORT=3001
RTMP_PORT=1935
HLS_PORT=8888
FFMPEG_PATH=/usr/bin/ffmpeg
MEDIA_ROOT=./media
NODE_ENV=development
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

## 📡 OBS Setup

1. Open OBS → Settings → Stream
2. Service: `Custom`
3. Server: `rtmp://localhost:1935/live`
4. Stream Key: copy from Dashboard → Settings tab
5. Click **Apply** → **OK** → **Start Streaming**

---

## 👤 Author

**Your Name**  
Full Stack Developer  
📧 your@email.com  
🔗 [github.com/your-username](https://github.com/your-username)
