import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import morgan from "morgan";
import { config } from "./config.js";
import authRoutes from "./routes/auth.js";
import taskRoutes from "./routes/tasks.js";

export function createApp() {
  const app = express();

  app.set("trust proxy", 1);
  app.use(helmet());
  app.use(
    cors({
      origin: config.frontendOrigin,
      credentials: true
    })
  );
  app.use(express.json({ limit: "128kb" }));
  app.use(morgan(config.nodeEnv === "production" ? "combined" : "dev"));
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 300,
      standardHeaders: "draft-7",
      legacyHeaders: false
    })
  );

  app.get("/health", (_req, res) => res.json({ ok: true }));
  app.use("/api/auth", authRoutes);
  app.use("/api/tasks", taskRoutes);

  app.use((error, _req, res, _next) => {
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  });

  return app;
}
