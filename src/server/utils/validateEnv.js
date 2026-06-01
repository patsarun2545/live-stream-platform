const fs = require("fs");
require("dotenv").config({ path: ".env.local" });

/**
 * Validate required environment variables
 * Throws Error if any required fields are missing or invalid
 */
function validateEnv() {
  const missing = [];
  const warnings = [];

  // REQUIRED fields (always)
  const required = ["MONGO_URI", "JWT_SECRET", "SITE_URL"];
  required.forEach((field) => {
    if (!process.env[field]) {
      missing.push(field);
    }
  });

  // JWT_SECRET must be at least 32 characters
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    throw new Error(
      `JWT_SECRET must be at least 32 characters long.\n` +
        `Run: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`,
    );
  }

  // REQUIRED IN PRODUCTION ONLY
  if (process.env.NODE_ENV === "production") {
    if (!process.env.ALLOWED_ORIGINS) {
      missing.push("ALLOWED_ORIGINS");
    }

    if (process.env.FFMPEG_PATH) {
      if (!fs.existsSync(process.env.FFMPEG_PATH)) {
        throw new Error(
          `FFMPEG_PATH does not exist: ${process.env.FFMPEG_PATH}`,
        );
      }
    } else {
      missing.push("FFMPEG_PATH");
    }
  }

  // OPTIONAL WITH DEFAULT (log warnings if missing)
  const optionalDefaults = {
    PORT: "3001",
    RTMP_PORT: "1935",
    HLS_PORT: "8888",
    MEDIA_ROOT: "./media",
  };

  Object.entries(optionalDefaults).forEach(([key, defaultValue]) => {
    if (!process.env[key]) {
      process.env[key] = defaultValue;
      warnings.push(`${key} not set, using default: ${defaultValue}`);
    }
  });

  // Log warnings
  if (warnings.length > 0) {
    console.warn("⚠️  Environment warnings:");
    warnings.forEach((warning) => console.warn(`  - ${warning}`));
  }

  // Throw error if required fields are missing
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables:\n  - ${missing.join("\n  - ")}`,
    );
  }

  console.log("✅ Environment validation passed");
}

module.exports = { validateEnv };
