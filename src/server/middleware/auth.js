const jwt = require("jsonwebtoken");
const User = require("../models/User");

const protect = async (req, res, next) => {
  try {
    // Try to get token from cookie first (httpOnly cookie)
    let token = req.cookies?.token;

    // Fallback to Authorization header for API clients
    if (!token) {
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith("Bearer ")) {
        token = authHeader.split(" ")[1];
      }
    }

    if (!token) {
      return res.status(401).json({ message: "ไม่มี token กรุณา login ก่อน" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = await User.findById(decoded.id).select("-passwordHash");
    if (!req.user) {
      return res.status(401).json({ message: "ไม่พบผู้ใช้" });
    }

    next();
  } catch {
    return res.status(401).json({ message: "Token ไม่ถูกต้องหรือหมดอายุ" });
  }
};

const streamerOnly = (req, res, next) => {
  if (!["streamer", "admin"].includes(req.user.role)) {
    return res.status(403).json({ message: "สิทธิ์ไม่เพียงพอ" });
  }
  next();
};

module.exports = { protect, streamerOnly };
