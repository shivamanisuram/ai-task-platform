import Redis from "ioredis";
import { config } from "./config.js";

export const redis = new Redis(config.redisUrl, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true
});

redis.on("error", (error) => {
  console.error("Redis error:", error.message);
});

export async function enqueueTask(taskId) {
  await redis.lpush("ai_tasks", JSON.stringify({ taskId, enqueuedAt: new Date().toISOString() }));
}
