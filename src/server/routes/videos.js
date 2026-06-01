const express = require("express");
const mongoose = require("mongoose");
const Video = require("../models/Video");
const User = require("../models/User");
const Comment = require("../models/Comment");
const { protect, streamerOnly } = require("../middleware/auth");
const rateLimit = require("express-rate-limit");
const { sanitizeText, sanitizeTags } = require("../utils/sanitize");

const router = express.Router();

const isObjectId = (v) => mongoose.isValidObjectId(v);

// Simple in-memory cache with TTL and LRU eviction
class SimpleCache {
  constructor(ttlMs, maxSize = 100) {
    this.ttlMs = ttlMs;
    this.maxSize = maxSize;
    this.cache = new Map();
  }

  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    // Update access time for LRU
    entry.lastAccessed = Date.now();
    return entry.value;
  }

  set(key, value) {
    // Evict oldest entry if at capacity
    if (this.cache.size >= this.maxSize) {
      let oldestKey = null;
      let oldestTime = Infinity;

      for (const [k, v] of this.cache.entries()) {
        if (v.lastAccessed < oldestTime) {
          oldestTime = v.lastAccessed;
          oldestKey = k;
        }
      }

      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      value,
      expiresAt: Date.now() + this.ttlMs,
      lastAccessed: Date.now(),
    });
  }

  invalidate(pattern) {
    const regex = new RegExp(pattern);
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  size() {
    return this.cache.size;
  }
}

const videoCache = new SimpleCache(5000, 100); // 5 second TTL, max 100 entries

// Rate limiter for viewer beacon endpoints (max 5 req/min per IP)
const viewerLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { message: "ลองใหม่อีกครั้งใน 1 นาที" },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter for comment endpoint (max 10 req/min per IP)
const commentLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { message: "ส่งความคิดเห็นบ่อยเกินไป กรุณารอสักครู่" },
  standardHeaders: true,
  legacyHeaders: false,
});

// GET /api/videos
router.get("/", async (req, res) => {
  try {
    const {
      category,
      search,
      page = 1,
      limit = 20,
      streamer,
      status,
    } = req.query;

    if (search) {
      const videos = await Video.search(search, Number(limit));
      return res.json({ videos, total: videos.length });
    }

    // Generate cache key from query parameters
    const cacheKey = JSON.stringify(req.query);
    const cached = videoCache.get(cacheKey);

    if (cached) {
      return res.set("x-cache", "HIT").json(cached);
    }

    const filter = {};

    if (streamer) {
      if (!isObjectId(streamer)) {
        return res.status(400).json({ message: "streamer id ไม่ถูกต้อง" });
      }
      filter.streamer = streamer;
    } else {
      filter.status = status || "live";
    }

    if (category) filter.category = category;

    const skip = (Number(page) - 1) * Number(limit);
    const [videos, total] = await Promise.all([
      Video.find(filter)
        .populate("streamer", "username avatar")
        .sort({ viewerCount: -1, createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Video.countDocuments(filter),
    ]);

    const result = { videos, total, page: Number(page) };
    videoCache.set(cacheKey, result);

    res.set("x-cache", "MISS").json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/videos/:slug
router.get("/:slug", async (req, res) => {
  try {
    const video = await Video.findOne({ slug: req.params.slug })
      .populate("streamer", "username avatar followers role")
      .lean();

    if (!video) return res.status(404).json({ message: "ไม่พบ stream นี้" });

    // Check if user is a bot/crawler
    const userAgent = req.headers["user-agent"] || "";
    const isBot = /bot|crawler|spider/i.test(userAgent);

    // Deduplicate view count using cookies
    const cookieName = `v_${video._id}`;
    const hasViewed = req.cookies && req.cookies[cookieName];

    if (!isBot && !hasViewed) {
      // Increment view count (fire-and-forget)
      Video.findByIdAndUpdate(video._id, { $inc: { totalViews: 1 } }).exec();
      // Set cookie to track view (1 hour expiry, httpOnly)
      res.cookie(cookieName, "1", {
        maxAge: 3600 * 1000, // 1 hour in milliseconds
        httpOnly: true,
      });
    }

    // Check if current user has liked this video
    const isLiked = req.user
      ? video.likedBy?.some((id) => id.toString() === req.user._id.toString())
      : false;

    res.json({
      video: {
        ...video,
        commentsCount: video.commentsCount || 0,
        isLiked,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/videos/:id/comments
router.get("/:id/comments", async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const videoId = req.params.id;

    if (!isObjectId(videoId)) {
      return res.status(400).json({ message: "video id ไม่ถูกต้อง" });
    }

    const video = await Video.findById(videoId);
    if (!video) return res.status(404).json({ message: "ไม่พบ stream นี้" });

    const result = await Comment.getByVideo(videoId, page, limit);

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/videos
router.post("/", protect, streamerOnly, async (req, res) => {
  try {
    const { title, description, category, tags } = req.body;

    // Sanitize input
    const sanitizedTitle = sanitizeText(title);
    const sanitizedDescription = sanitizeText(description);
    const sanitizedTags = sanitizeTags(tags);

    const user = await User.findById(req.user._id).select("+streamKey");
    const video = await Video.create({
      title: sanitizedTitle,
      description: sanitizedDescription,
      category,
      tags: sanitizedTags,
      streamer: req.user._id,
      hlsUrl: `/hls/live/${user.streamKey}/index.m3u8`,
      status: "live",
    });

    await video.populate("streamer", "username avatar");

    // Invalidate all cache entries when a new video is created
    videoCache.invalidate(".*");

    res.status(201).json({ video });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PATCH /api/videos/:slug
router.patch("/:slug", protect, streamerOnly, async (req, res) => {
  try {
    const param = req.params.slug;
    const query = isObjectId(param) ? { _id: param } : { slug: param };
    const video = await Video.findOne(query);

    if (!video) return res.status(404).json({ message: "ไม่พบ stream" });

    if (video.streamer.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "ไม่ใช่เจ้าของ stream นี้" });
    }

    const ALLOWED_FIELDS = [
      "title",
      "description",
      "category",
      "tags",
      "thumbnail",
      "status",
    ];

    ALLOWED_FIELDS.forEach((f) => {
      if (req.body[f] !== undefined) {
        // Sanitize text fields
        if (f === "title") {
          video[f] = sanitizeText(req.body[f]);
        } else if (f === "description") {
          video[f] = sanitizeText(req.body[f]);
        } else if (f === "tags") {
          video[f] = sanitizeTags(req.body[f]);
        } else {
          video[f] = req.body[f];
        }
      }
    });

    if (req.body.status === "ended" && !video.endedAt) {
      video.endedAt = new Date();
    }

    await video.save();

    // Invalidate all cache entries when a video is updated
    videoCache.invalidate(".*");

    res.json({ video });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// POST /api/videos/:id/comments
router.post("/:id/comments", protect, commentLimiter, async (req, res) => {
  try {
    const text = req.body.text?.trim();

    // Validate text
    if (!text || /^\s*$/.test(text)) {
      return res.status(400).json({ message: "กรุณาใส่ข้อความ" });
    }

    if (text.length > 300) {
      return res
        .status(400)
        .json({ message: "ข้อความต้องไม่เกิน 300 ตัวอักษร" });
    }

    const video = await Video.findById(req.params.id);
    if (!video) return res.status(404).json({ message: "ไม่พบ stream นี้" });

    // Sanitize comment text
    const sanitizedText = sanitizeText(text);

    // Check for duplicate comment within 30 seconds
    const thirtySecondsAgo = new Date(Date.now() - 30 * 1000);
    const hasDuplicate = await Comment.findOne({
      video: req.params.id,
      user: req.user._id,
      text: sanitizedText,
      createdAt: { $gt: thirtySecondsAgo },
    });

    if (hasDuplicate) {
      return res.status(429).json({ message: "ความคิดเห็นซ้ำกัน" });
    }

    // Create comment document
    const comment = await Comment.create({
      video: req.params.id,
      user: req.user._id,
      text: sanitizedText,
    });

    // Increment commentsCount in video
    await Video.findByIdAndUpdate(req.params.id, {
      $inc: { commentsCount: 1 },
    });

    // Populate user data
    await comment.populate("user", "username avatar");

    // Invalidate cache
    videoCache.invalidate(".*");

    res.status(201).json({ comment });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/videos/:id/like
router.post("/:id/like", protect, async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);
    if (!video) return res.status(404).json({ message: "ไม่พบ stream นี้" });

    // Check if user already liked this video
    if (
      video.likedBy?.some((id) => id.toString() === req.user._id.toString())
    ) {
      return res.status(409).json({ message: "กด Like ไปแล้ว" });
    }

    // Add user to likedBy and increment likes in one operation to prevent race condition
    const updated = await Video.findByIdAndUpdate(
      req.params.id,
      {
        $addToSet: { likedBy: req.user._id },
        $inc: { likes: 1 },
      },
      { new: true },
    );

    // Invalidate all cache entries when a video is liked
    videoCache.invalidate(".*");

    res.json({ likes: updated.likes });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/videos/:id/viewers/join
router.post("/:id/viewers/join", viewerLimiter, async (req, res) => {
  try {
    const video = await Video.findByIdAndUpdate(
      req.params.id,
      { $inc: { viewerCount: 1 } },
      { new: true },
    );

    if (!video) return res.status(404).json({ message: "ไม่พบ stream นี้" });

    res.json({ viewerCount: video.viewerCount + 1 });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/videos/:id/viewers/leave
router.post("/:id/viewers/leave", viewerLimiter, async (req, res) => {
  try {
    const video = await Video.findByIdAndUpdate(
      req.params.id,
      [
        {
          $set: {
            viewerCount: { $max: [{ $subtract: ["$viewerCount", 1] }, 0] },
          },
        },
      ],
      { new: true },
    );

    if (!video) return res.status(404).json({ message: "ไม่พบ stream นี้" });

    res.json({ viewerCount: video.viewerCount });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
