const mongoose = require("mongoose");

let isConnected = false;
let isReconnecting = false;
let retryCount = 0;
let retryDelay = 5000;
const MAX_RETRIES = 10;
const MAX_RETRY_DELAY = 60000;

async function connectDB() {
  if (isConnected) return;

  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    isConnected = true;
    console.log(`✅ MongoDB connected: ${conn.connection.host}`);
  } catch (err) {
    console.error("❌ MongoDB connection failed:", err.message);
    process.exit(1);
  }
}

mongoose.connection.on("connected", () => {
  console.log("✅ MongoDB reconnected successfully");
  retryCount = 0;
  retryDelay = 5000;
  isReconnecting = false;
});

mongoose.connection.on("disconnected", () => {
  console.warn("⚠️  MongoDB disconnected — retrying...");
  isConnected = false;

  if (isReconnecting) return;
  isReconnecting = true;

  if (retryCount >= MAX_RETRIES) {
    console.error("❌ Max reconnection attempts reached. Exiting application.");
    process.exit(1);
  }

  console.log(
    `Retrying in ${retryDelay / 1000}s... (attempt ${retryCount + 1}/${MAX_RETRIES})`,
  );

  setTimeout(() => {
    retryCount++;
    retryDelay = Math.min(retryDelay * 2, MAX_RETRY_DELAY);
    connectDB();
  }, retryDelay);
});

mongoose.connection.on("error", (err) => {
  console.error("❌ MongoDB connection error:", err.message);
  // Don't exit here, let disconnected handler handle retry
});

module.exports = connectDB;
