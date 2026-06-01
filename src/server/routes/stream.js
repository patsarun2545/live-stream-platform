const express = require("express");
const User = require("../models/User");
const Video = require("../models/Video");
const { protect, streamerOnly } = require("../middleware/auth");
const { activeSessions } = require("../mediaServer");

const router = express.Router();

// GET /api/stream/key
router.get("/key", protect, streamerOnly, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("+streamKey");
    res.json({ streamKey: user.streamKey });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/stream/key/reset
router.post("/key/reset", protect, streamerOnly, async (req, res) => {
  try {
    const { confirm } = req.body;

    // Check confirm flag
    if (!confirm) {
      return res.status(400).json({
        message: "กรุณายืนยันการ reset — stream ที่กำลัง live จะถูกตัด",
      });
    }

    const user = await User.findById(req.user._id).select("+streamKey");
    const oldKey = user.streamKey;

    // Generate new stream key
    user.generateStreamKey();
    await user.save();

    // Kill ffmpeg process of old key if active
    const oldSession = activeSessions.get(oldKey);
    if (oldSession) {
      oldSession.kill("SIGTERM");
      activeSessions.delete(oldKey);
    }

    // Update live video to ended
    await Video.findOneAndUpdate(
      { streamer: user._id, status: "live" },
      { status: "ended", endedAt: new Date() },
      { sort: { createdAt: -1 } },
    );

    res.json({
      streamKey: user.streamKey,
      message: "Stream เก่าถูกยกเลิกแล้ว",
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/stream/status/:streamKey  (public)
router.get("/status/:streamKey", async (req, res) => {
  try {
    const streamer = await User.findOne({
      streamKey: req.params.streamKey,
    }).select("_id username");
    if (!streamer) return res.status(404).json({ live: false });

    const video = await Video.findOne(
      { streamer: streamer._id, status: "live" },
      "title viewerCount hlsUrl slug",
    ).lean();

    res.json({
      live: !!video,
      video: video || null,
      streamer: { username: streamer.username },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
