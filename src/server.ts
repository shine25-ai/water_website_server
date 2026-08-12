import http from "http";
import dotenv from "dotenv";
import app from "./index.js";
import { connectDB, closeDB } from "./config/db.js";

dotenv.config();

const PORT = process.env.PORT || 5001;

// Create HTTP server with Express app
const server = http.createServer(app);

// Handle server error events (e.g. port already in use)
server.on("error", (err: any) => {
  if (err.code === "EADDRINUSE") {
    console.error(`❌ Port ${PORT} is already in use.`);
    console.error(`💡 Tip: On macOS, Port 5000 is used by AirPlay Receiver. Port has been updated to ${PORT} in .env.`);
  } else {
    console.error("❌ Server error:", err);
  }
  process.exit(1);
});

// Connect to Database
connectDB().catch((err) => {
  console.error("[MongoDB] Initialization error:", err);
});

// Start listening
server.listen(PORT, () => {
  console.log(`🚀 Server started on port ${PORT}`);
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`📊 Healthcheck API: http://localhost:${PORT}/api/health`);
});

// Graceful shutdown handling
const shutdown = async (signal: string) => {
  console.log(`\n[Server] ${signal} signal received. Shutting down gracefully...`);
  server.close(async () => {
    await closeDB();
    console.log("[Server] Server closed successfully.");
    process.exit(0);
  });
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

export default server;
