const NodeMediaServer = require("node-media-server");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");
const Video = require("./models/Video");
const User = require("./models/User");

// Track active streaming sessions
const activeSessions = new Map();

// Helper function to redact sensitive keys in logs
function redactKey(key) {
  if (!key) return "****";
  return key.substring(0, 4) + "****";
}

const MEDIA_ROOT = process.env.MEDIA_ROOT
  ? path.resolve(process.env.MEDIA_ROOT)
  : path.join(process.cwd(), "media");

const RTMP_PORT = Number(process.env.RTMP_PORT) || 1935;
const HLS_PORT = Number(process.env.HLS_PORT) || 8888;
const FFMPEG_PATH = process.env.FFMPEG_PATH || "/usr/bin/ffmpeg";

const nms = new NodeMediaServer({
  rtmp: {
    port: RTMP_PORT,
    chunk_size: 60000,
    gop_cache: true,
    ping: 30,
    ping_timeout: 60,
  },
  http: {
    port: HLS_PORT,
    mediaroot: MEDIA_ROOT,
    allow_origin: "*",
  },
});

function getStreamKey(id, StreamPath) {
  if (id?.streamName) return id.streamName;
  if (id?.streamPath) return id.streamPath.split("/").pop();
  if (StreamPath && StreamPath !== "undefined")
    return StreamPath.split("/").pop();
  return "";
}

nms.on("prePublish", async (id, StreamPath) => {
  const streamKey = getStreamKey(id, StreamPath);
  if (!streamKey) return;

  try {
    const streamer = await User.findOne({ streamKey }).select("+streamKey");
    if (!streamer) {
      console.log(`[NMS] Rejected unknown stream key: ${redactKey(streamKey)}`);
      return;
    }

    await Video.findOneAndUpdate(
      { streamer: streamer._id, status: "live" },
      { hlsUrl: `/hls/live/${streamKey}/index.m3u8` },
      { sort: { createdAt: -1 } },
    );

    // Spawn ffmpeg for HLS transcoding
    const outDir = path.join(MEDIA_ROOT, "live", streamKey);
    fs.mkdirSync(outDir, { recursive: true });

    const ffmpeg = spawn(FFMPEG_PATH, [
      "-i",
      `rtmp://127.0.0.1:${RTMP_PORT}/live/${streamKey}`,
      "-c:v",
      "copy",
      "-c:a",
      "copy",
      "-f",
      "hls",
      "-hls_time",
      "2",
      "-hls_list_size",
      "3",
      "-hls_flags",
      "delete_segments",
      path.join(outDir, "index.m3u8"),
    ]);

    ffmpeg.stderr.on("data", (d) => {
      const msg = d.toString();
      if (msg.includes("Error") || msg.includes("error")) {
        console.error("[FFMPEG]", msg.trim());
      }
    });

    ffmpeg.on("close", (code) => {
      console.log(`[FFMPEG] process exited with code ${code}`);
    });

    // Track active session
    activeSessions.set(streamKey, { id, ffmpeg });

    console.log(`[NMS] Stream started: ${streamer.username}`);
  } catch (err) {
    console.error("[NMS] prePublish error:", err.message);
  }
});

nms.on("donePublish", async (id, StreamPath) => {
  const streamKey = getStreamKey(id, StreamPath);
  if (!streamKey) return;

  try {
    const streamer = await User.findOne({ streamKey });
    if (!streamer) return;

    await Video.findOneAndUpdate(
      { streamer: streamer._id, status: "live" },
      { status: "ended", endedAt: new Date() },
      { sort: { createdAt: -1 }, returnDocument: "after" },
    );

    // Kill ffmpeg and remove from active sessions
    const session = activeSessions.get(streamKey);
    if (session?.ffmpeg) session.ffmpeg.kill();
    activeSessions.delete(streamKey);

    console.log(`[NMS] Stream ended: ${streamer.username}`);
  } catch (err) {
    console.error("[NMS] donePublish error:", err.message);
  }
});

nms.on("error", (err) => {
  console.error("[NMS] Server error:", err.message);
});

module.exports = { nms, activeSessions };
