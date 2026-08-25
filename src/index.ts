import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import healthRoutes from "./routes/health.routes.js";
import donationRoutes from "./routes/donation.routes.js";
import volunteerRoutes from "./routes/Volunteer.routes.js";
import authRoutes from "./routes/Auth.routes.js";
import overviewRoutes from "./routes/Overview.routes.js";
import fundraisingRoutes from "./routes/Fundraising.routes.js";
import dashboardRoutes from "./routes/Dashboard.routes.js";
import galleryRoutes from "./routes/Gallery.routes.js";
import newsupdateRoutes from "./routes/Newsupdate.routes.js";
import documentRoutes from "./routes/Document.routes.js";



dotenv.config();

console.log("[env check]", {
  cwd: process.cwd(),
  hasUsername: !!process.env.ADMIN_USERNAME,
  hasPassword: !!process.env.ADMIN_PASSWORD,
  hasSecret: !!process.env.JWT_SECRET,
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middleware configuration
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "*",
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files (gallery photos, banner images, etc.) — uploads/
// lives at the project root, same level as this server's cwd.
const uploadsPath = path.resolve(process.cwd(), "uploads");
fs.mkdirSync(uploadsPath, { recursive: true });
app.use("/uploads", express.static(uploadsPath));

// Healthcheck API Routes
app.use("/api/health", healthRoutes);
app.use("/health", healthRoutes);
app.use("/api/donations", donationRoutes);
app.use("/api/volunteers", volunteerRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/overview", overviewRoutes);
app.use("/api/fundraising", fundraisingRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/gallery", galleryRoutes);
app.use("/api/news", newsupdateRoutes);
app.use("/api/documents", documentRoutes);
;


// Base API route
app.get("/api", (req, res) => {
  res.json({
    message: "Water App Server API is active",
    endpoints: {
      health: "/api/health",
    },
  });
});

// Resolve frontend dist directory path relative to current working directory
const relativeDistPath = process.env.FRONTEND_DIST_PATH || "../water_website/dist";
const distPath = path.resolve(process.cwd(), relativeDistPath);

console.log(`[Static Files] Configured frontend dist path: ${distPath}`);

// Serve static frontend assets if directory exists
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
}

// Catch-all SPA router fallback (Compatible with Express 5 path-to-regexp)
app.use((req, res, next) => {
  // Only handle GET requests for SPA fallback
  if (req.method !== "GET") {
    return next();
  }

  // If request path starts with /api, return 404 JSON for unknown API routes
  if (req.path.startsWith("/api")) {
    res.status(404).json({ error: `API Route '${req.path}' not found` });
    return;
  }

  const indexPath = path.join(distPath, "index.html");
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(200).send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Water App Backend</title>
        <style>
          body { font-family: system-ui, -apple-system, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
          .card { background: #1e293b; padding: 2.5rem; border-radius: 1rem; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); text-align: center; max-width: 480px; }
          h1 { color: #38bdf8; margin-top: 0; }
          p { color: #94a3b8; line-height: 1.5; }
          .status { display: inline-block; padding: 0.5rem 1rem; background: #0369a1; color: #e0f2fe; border-radius: 0.5rem; font-weight: 600; margin-top: 1rem; }
          a { color: #38bdf8; text-decoration: none; font-weight: 500; }
          a:hover { text-decoration: underline; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>🌊 Water App Server</h1>
          <p>Server is running smoothly. Frontend dist file (<code>index.html</code>) is not built yet.</p>
          <p>Build the frontend project in <code>water_website</code> to serve the full app web interface.</p>
          <div class="status">API Health Check: <a href="/api/health">/api/health</a></div>
        </div>
      </body>
      </html>
    `);
  }
});

export default app;