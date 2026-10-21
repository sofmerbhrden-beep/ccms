import "dotenv/config";
import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";

import connectDB from "./config/db.js";
import sessionRoutes from "./routes/sessionRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import applicationRoutes from "./routes/applicationRoutes.js";
import certificateRoutes from "./routes/certificateRoutes.js";
import serviceTypeRoutes from "./routes/serviceTypeRoutes.js";
import businessRegistrationRoutes from "./routes/businessRegistrationRoutes.js";
import settingsRoutes from "./routes/settingsRoutes.js";
import reportRoutes from "./routes/reportRoutes.js";
import { notFound, errorHandler } from "./middleware/errorMiddleware.js";
import { protect } from "./middleware/authMiddleware.js";
import { blockCertificatePdfStaticAccess } from "./middleware/certificateStaticGuard.js";
import { API_ROOT } from "./utils/representations.js";

export const sseClients = new Map();

export function broadcastSSE(event) {
  const payload = `data: ${JSON.stringify(event)}\n\n`;
  for (const clients of sseClients.values()) {
    for (const res of clients) {
      res.write(payload);
    }
  }
}

import { initCronJobs } from "./cron/expirationJob.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

await connectDB();
initCronJobs();

const app = express();

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 150, // limit each IP to 150 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: "error", message: "Too many requests from this IP, please try again later." }
});
app.use("/api", apiLimiter);

app.use(
  cors({
    origin: [
      process.env.CLIENT_ORIGIN || "http://localhost:5173",
      "http://192.168.8.111:5173",
    ],
    credentials: true,
  }),
);
app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());

app.use(
  "/uploads",
  protect,
  blockCertificatePdfStaticAccess,
  express.static(path.join(__dirname, "uploads"), {
    immutable: true,
    maxAge: "1d",
  }),
);

app.get(API_ROOT, (req, res) => {
  res.set("Cache-Control", "public, max-age=3600");
  res.json({
    name: "CCMS REST API",
    version: "1.0",
    _links: {
      self: { href: API_ROOT },
      sessions: { href: `${API_ROOT}/sessions`, method: "POST" },
      current_session: { href: `${API_ROOT}/sessions/current` },
      users: { href: `${API_ROOT}/users` },
      applications: { href: `${API_ROOT}/applications` },
      service_types: { href: `${API_ROOT}/service-types` },
      certificates: {
        href: `${API_ROOT}/certificates/{year}/{seq}`,
        templated: true,
      },
      business_registrations: {
        href: `${API_ROOT}/business-registrations/{tin}`,
        templated: true,
      },
      settings: { href: `${API_ROOT}/settings` },
    },
  });
});

app.get("/api/health", (req, res) => {
  res.set("Cache-Control", "no-store");
  res.json({ status: "ok" });
});

app.get("/api/health/mail", async (req, res) => {
  try {
    const { verifyMailer } = await import("./utils/mailer.js");
    await verifyMailer();
    res.json({
      status: "ok",
      provider: process.env.RESEND_API_KEY ? "resend" : "smtp",
      keySet: !!process.env.RESEND_API_KEY,
      testTo: process.env.RESEND_TEST_TO || null,
    });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

app.get("/api/health/mail/send", async (req, res) => {
  try {
    const to = process.env.RESEND_TEST_TO;
    if (!to)
      return res
        .status(400)
        .json({ status: "error", message: "RESEND_TEST_TO is not configured" });
    const { sendTestEmail } = await import("./utils/mailer.js");
    await sendTestEmail(to);
    res.json({
      status: "sent",
      to,
      keySet: !!process.env.RESEND_API_KEY,
      testTo: process.env.RESEND_TEST_TO,
    });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

app.get(`${API_ROOT}/events`, protect, (req, res) => {
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "X-Accel-Buffering": "no",
    Connection: "keep-alive",
  });
  res.flushHeaders();
  res.write('data: {"type":"connected"}\n\n');

  const uid = String(req.user._id);
  if (!sseClients.has(uid)) sseClients.set(uid, new Set());
  sseClients.get(uid).add(res);

  const keepAlive = setInterval(() => res.write(": ping\n\n"), 25000);

  req.on("close", () => {
    clearInterval(keepAlive);
    sseClients.get(uid)?.delete(res);
    if (sseClients.get(uid)?.size === 0) sseClients.delete(uid);
  });
});

app.use(`${API_ROOT}/sessions`, sessionRoutes);
app.use(`${API_ROOT}/users`, userRoutes);
app.use(`${API_ROOT}/applications`, applicationRoutes);
app.use(`${API_ROOT}/certificates`, certificateRoutes);
app.use(`${API_ROOT}/service-types`, serviceTypeRoutes);
app.use(`${API_ROOT}/settings`, settingsRoutes);
app.use(`${API_ROOT}/reports`, reportRoutes);
app.use(`${API_ROOT}/business-registrations`, businessRegistrationRoutes);

if (process.env.NODE_ENV === "production") {
  const frontendDist = path.join(__dirname, "..", "frontend", "dist");

  app.use(express.static(frontendDist));

  app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(frontendDist, "index.html"));
  });
}

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`API listening on http://localhost:${PORT}${API_ROOT}`),
);
