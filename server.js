// Validate environment variables first
const { validateEnv } = require("./src/server/utils/validateEnv");
validateEnv();

const { createServer } = require("http");
const { parse } = require("url");
const path = require("path");
const next = require("next");
const express = require("express");
const cors = require("cors");
const compression = require("compression");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const { WebSocketServer, WebSocket } = require("ws");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const User = require("./src/server/models/User");

const MEDIA_ROOT = process.env.MEDIA_ROOT
  ? path.resolve(process.env.MEDIA_ROOT)
  : path.join(process.cwd(), "media");

const PORT = process.env.PORT || 3001;
const dev = process.env.NODE_ENV !== "production";

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((origin) => origin.trim())
  : [];

let httpServer;
let wss;
let nms;

async function start() {
  const nextApp = next({ dev });
  const handle = nextApp.getRequestHandler();
  await nextApp.prepare();

  const server = express();

  const corsOptions = {
    origin: (origin, callback) => {
      if (dev) {
        callback(null, true);
        return;
      }
      if (!origin) {
        callback(null, true);
        return;
      }
      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error("Origin not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  };

  server.use(cors(corsOptions));
  server.options("/{*any}", cors(corsOptions));
  server.use(cookieParser());
  server.use(compression({ level: 6 }));
  server.use(express.json());

  server.use((req, res, next) => {
    const reqId = Math.random().toString(36).slice(2, 10);
    res.locals.reqId = reqId;
    res.setHeader("X-Request-Id", reqId);
    next();
  });

  server.use((req, res, next) => {
    const startTime = Date.now();
    const originalSend = res.send;
    const skipPaths = ["/hls/", "/api/videos"];
    const shouldSkip = skipPaths.some((p) => req.path.startsWith(p));

    res.send = function (data) {
      const duration = Date.now() - startTime;
      const timestamp = new Date().toISOString();
      const { reqId } = res.locals;
      const { method, path, ip } = req;
      const userAgent = req.get("user-agent") || "-";
      const statusCode = res.statusCode;
      const shouldLog = dev || statusCode >= 400;

      if (shouldLog && !shouldSkip) {
        const logMessage = `[${timestamp}] ${reqId} ${method} ${path} ${statusCode} ${duration}ms`;
        const logData = {
          reqId,
          method,
          path,
          statusCode,
          duration,
          ip,
          userAgent,
        };
        if (statusCode >= 400) {
          console.error(logMessage, logData);
        } else {
          console.log(logMessage, logData);
        }
        if (duration > 1000) console.warn(`[SLOW] ${logMessage}`);
      }

      originalSend.call(this, data);
    };

    next();
  });

  const hlsOrigin = process.env.HLS_ORIGIN || "*";
  server.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "blob:"],
          mediaSrc: ["'self'", "blob:", hlsOrigin],
          connectSrc: ["'self'", "ws:", "wss:"],
          frameSrc: ["'self'"],
        },
      },
      crossOriginResourcePolicy: { policy: "cross-origin" },
    }),
  );

  server.use(
    "/hls",
    express.static(MEDIA_ROOT, {
      etag: true,
      fallthrough: true,
      setHeaders: (res, filePath) => {
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
        res.setHeader("Access-Control-Expose-Headers", "Content-Length");
        const ext = path.extname(filePath).toLowerCase();
        if (ext === ".m3u8") {
          res.setHeader("Cache-Control", "no-cache, no-store");
        } else if (ext === ".ts") {
          res.setHeader("Cache-Control", "public, max-age=86400");
        } else if (ext === ".key") {
          res.setHeader("Cache-Control", "no-store");
        } else {
          res.setHeader("Cache-Control", "no-cache");
        }
      },
    }),
    (req, res) => {
      res.status(404).json({ message: "Stream not available" });
    },
    // Error handler สำหรับ ENOENT
    (err, req, res, next) => {
      if (err.code === "ENOENT") {
        return res.status(404).json({ message: "Stream not available" });
      }
      next(err);
    },
  );

  const connectDB = require("./src/server/db");
  await connectDB();

  server.use("/api/auth", require("./src/server/routes/auth"));
  server.use("/api/videos", require("./src/server/routes/videos"));
  server.use("/api/stream", require("./src/server/routes/stream"));
  server.use("/", require("./src/server/routes/seo"));

  server.use((err, req, res, next) => {
    const { reqId } = res.locals;
    const { method, path } = req;
    console.error(`[ERROR] ${reqId} ${method} ${path}`, {
      reqId,
      method,
      path,
      error: err.message,
      stack: dev ? err.stack : undefined,
    });
    res.status(err.status || 500).json({
      message: err.message || "Internal Server Error",
      ...(dev && { stack: err.stack }),
    });
  });

  server.all("/{*any}", (req, res) => handle(req, res, parse(req.url, true)));

  httpServer = createServer(server);
  wss = setupWebSocket(httpServer);

  httpServer.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });

  const mediaServerModule = require("./src/server/mediaServer");
  nms = mediaServerModule.nms;
  nms.run();
  console.log(`📡 RTMP on port ${process.env.RTMP_PORT || 1935}`);
  console.log(`📺 HLS  on port ${process.env.HLS_PORT || 8888}`);
}

function setupWebSocket(httpServer) {
  const wss = new WebSocketServer({ server: httpServer });
  const rooms = new Map();

  wss.on("connection", (ws, req) => {
    const match = req.url.match(/^\/chat\/([a-f0-9]{24})(?:\?token=([^&]+))?$/);
    if (!match) return ws.terminate();

    const videoId = match[1];

    // Parse cookies from WebSocket handshake headers
    const cookies = req.headers.cookie;

    if (cookies) {
      // Try to find session cookie and verify user
      const cookieArray = cookies.split(";").map((c) => c.trim());
      const sessionCookie = cookieArray.find((c) => c.startsWith("token="));

      if (sessionCookie) {
        const token = sessionCookie.split("=")[1];
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          User.findById(decoded.id)
            .then((foundUser) => {
              if (foundUser) {
                ws.user = { id: foundUser._id, username: foundUser.username };
              }
            })
            .catch(() => {});
        } catch {
          // Invalid token, continue without auth
        }
      }
    }

    if (!rooms.has(videoId)) rooms.set(videoId, new Set());
    rooms.get(videoId).add(ws);

    ws.on("message", (raw) => {
      try {
        const data = JSON.parse(raw.toString());
        if (data.type !== "message" || !data.text?.trim()) return;
        if (!ws.user) return; // Require authentication

        const payload = JSON.stringify({
          username: ws.user.username.substring(0, 30),
          text: data.text.trim().substring(0, 200),
          timestamp: Date.now(),
        });
        rooms.get(videoId)?.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) client.send(payload);
        });
      } catch {
        /* ignore */
      }
    });

    ws.on("close", () => {
      rooms.get(videoId)?.delete(ws);
      if (rooms.get(videoId)?.size === 0) rooms.delete(videoId);
    });

    ws.on("error", () => ws.close());
  });

  return wss;
}

// ── Graceful Shutdown ─────────────────────────────────────────────
async function shutdown(signal) {
  console.log(`\n🛑 Received ${signal}, starting graceful shutdown...`);

  // Force exit after 10 seconds if shutdown hangs
  setTimeout(() => {
    console.error("⚠️  Shutdown timeout, forcing exit");
    process.exit(1);
  }, 10000);

  if (httpServer) {
    console.log("  [1/5] Stopping HTTP server...");
    await new Promise((resolve) => {
      httpServer.close(() => {
        console.log("  ✓ HTTP server stopped");
        resolve();
      });
    });
  }

  if (wss) {
    console.log("  [2/5] Closing WebSocket connections...");
    wss.clients.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN)
        ws.close(1001, "Server shutting down");
    });
    console.log("  ✓ WebSocket connections closed");
  }

  if (nms) {
    console.log("  [3/5] Stopping Node Media Server...");
    nms.stop();
    console.log("  ✓ NMS stopped");
  }

  if (mongoose.connection.readyState !== 0) {
    console.log("  [4/5] Disconnecting MongoDB...");
    await mongoose.connection.close();
    console.log("  ✓ MongoDB disconnected");
  }

  console.log("  [5/5] Shutdown complete");
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

process.on("uncaughtException", (err) => {
  console.error("❌ Uncaught Exception:", err);
  shutdown("uncaughtException");
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ Unhandled Rejection at:", promise, "reason:", reason);
  shutdown("unhandledRejection");
});

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
