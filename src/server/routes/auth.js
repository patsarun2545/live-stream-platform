const express = require("express");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const User = require("../models/User");
const { protect } = require("../middleware/auth");
const { sanitizeUsername, sanitizeText } = require("../utils/sanitize");

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === "production" ? 10 : 1000,
  message: { message: "ลองใหม่อีกครั้งใน 15 นาที" },
  standardHeaders: true,
  legacyHeaders: false,
});

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "7d" });

// Helper function to validate registration input
function validateRegisterInput(body) {
  const { username, email, password } = body;

  // Validate username: only a-z, A-Z, 0-9, _ allowed
  if (!username || !/^[a-zA-Z0-9_]+$/.test(username)) {
    return {
      valid: false,
      message: "ชื่อผู้ใช้ต้องประกอบด้วยตัวอักษร a-z, A-Z, 0-9 และ _ เท่านั้น",
    };
  }

  // Validate email pattern
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    return { valid: false, message: "รูปแบบอีเมลไม่ถูกต้อง" };
  }

  // Validate password: at least 8 characters
  if (!password || password.length < 8) {
    return { valid: false, message: "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร" };
  }

  // Validate password: at least 1 number
  if (!/\d/.test(password)) {
    return { valid: false, message: "รหัสผ่านต้องมีตัวเลขอย่างน้อย 1 ตัว" };
  }

  return { valid: true };
}

// POST /api/auth/register
router.post("/register", authLimiter, async (req, res) => {
  try {
    const { username, email, password, role } = req.body;

    // Sanitize input
    const sanitizedUsername = sanitizeUsername(username);
    const sanitizedEmail = sanitizeText(email);

    // Validate input before processing
    const validation = validateRegisterInput({
      username: sanitizedUsername,
      email: sanitizedEmail,
      password,
    });
    if (!validation.valid) {
      return res.status(400).json({ message: validation.message });
    }

    const existing = await User.findOne({
      $or: [{ email: sanitizedEmail }, { username: sanitizedUsername }],
    });
    if (existing) {
      const message =
        existing.email === sanitizedEmail
          ? "อีเมลนี้ถูกใช้งานแล้ว"
          : "ชื่อผู้ใช้นี้ถูกใช้งานแล้ว";
      return res.status(400).json({ message });
    }

    const user = new User({
      username: sanitizedUsername,
      email: sanitizedEmail,
      passwordHash: password,
      role: role === "streamer" ? "streamer" : "viewer",
    });

    if (user.role === "streamer") user.generateStreamKey();
    await user.save();

    const token = signToken(user._id);

    // Set httpOnly cookie
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // Return token in body for backward compatibility during migration
    res.status(201).json({ token, user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/auth/login
router.post("/login", authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select("+passwordHash");
    const isMatch = user && (await user.comparePassword(password));

    if (!isMatch) {
      return res.status(401).json({ message: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" });
    }

    const token = signToken(user._id);

    // Set httpOnly cookie
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // Return token in body for backward compatibility during migration
    res.json({ token, user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/auth/me
router.get("/me", protect, (req, res) => {
  res.json({ user: req.user });
});

// PATCH /api/auth/me
router.patch("/me", protect, async (req, res) => {
  try {
    const ALLOWED_FIELDS = ["username", "avatar"];
    const updates = Object.fromEntries(
      ALLOWED_FIELDS.filter((f) => req.body[f] !== undefined).map((f) => [
        f,
        f === "username" ? sanitizeUsername(req.body[f]) : req.body[f],
      ]),
    );

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: "ไม่มีข้อมูลที่จะอัปเดต" });
    }

    const user = await User.findByIdAndUpdate(req.user._id, updates, {
      new: true,
      runValidators: true,
    });
    res.json({ user });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// POST /api/auth/logout
router.post("/logout", (req, res) => {
  res.clearCookie("token");
  res.status(200).json({ message: "ออกจากระบบสำเร็จ" });
});

module.exports = router;
