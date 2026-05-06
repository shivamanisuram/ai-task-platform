import dotenv from "dotenv";

dotenv.config();

export const config = {
  port: Number(process.env.PORT || 4000),
  nodeEnv: process.env.NODE_ENV || "development",
  mongoUri: process.env.MONGO_URI || "mongodb://localhost:27017/ai_task_platform",
  redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  frontendOrigin: process.env.FRONTEND_ORIGIN || "http://localhost:5173"
};

if (!config.jwtSecret && config.nodeEnv === "production") {
  throw new Error("JWT_SECRET is required in production");
}

if (!config.jwtSecret) {
  config.jwtSecret = "local-development-only-secret";
}
