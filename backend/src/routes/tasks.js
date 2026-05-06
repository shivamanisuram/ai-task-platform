import crypto from "crypto";
import express from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { Task } from "../models/Task.js";
import { enqueueTask, redis } from "../queue.js";

const router = express.Router();

const createTaskSchema = z.object({
  title: z.string().min(1).max(120),
  inputText: z.string().min(1).max(10000),
  operation: z.enum(["uppercase", "lowercase", "reverse", "word_count"])
});

router.use(requireAuth);

function mongoReady() {
  return mongoose.connection.readyState === 1;
}

function redisTaskKey(id) {
  return `task:${id}`;
}

async function getRedisTask(id) {
  const raw = await redis.get(redisTaskKey(id));
  return raw ? JSON.parse(raw) : null;
}

router.get("/", async (req, res, next) => {
  try {
    if (!mongoReady()) {
      const ids = await redis.lrange(`user:${req.user.sub}:tasks`, 0, 99);
      const tasks = [];
      for (const id of ids) {
        const task = await getRedisTask(id);
        if (task) {
          const summary = { ...task };
          delete summary.inputText;
          delete summary.logs;
          tasks.push(summary);
        }
      }
      return res.json({ tasks });
    }

    const tasks = await Task.find({ userId: req.user.sub })
      .sort({ createdAt: -1 })
      .limit(100)
      .select("title operation status result error createdAt updatedAt finishedAt");

    return res.json({ tasks });
  } catch (error) {
    return next(error);
  }
});

router.post("/", validate(createTaskSchema), async (req, res, next) => {
  try {
    if (!mongoReady()) {
      const now = new Date().toISOString();
      const task = {
        _id: crypto.randomUUID(),
        userId: req.user.sub,
        title: req.body.title,
        inputText: req.body.inputText,
        operation: req.body.operation,
        status: "pending",
        result: null,
        error: null,
        logs: [{ message: "Task created and queued", timestamp: now }],
        createdAt: now,
        updatedAt: now,
        startedAt: null,
        finishedAt: null
      };

      await redis.set(redisTaskKey(task._id), JSON.stringify(task));
      await redis.lpush(`user:${req.user.sub}:tasks`, task._id);

      try {
        await enqueueTask(task._id);
      } catch (queueError) {
        task.status = "failed";
        task.error = "Queue unavailable. Try again later.";
        task.finishedAt = new Date().toISOString();
        task.logs.push({ message: `Failed to enqueue task: ${queueError.message}`, timestamp: task.finishedAt });
        await redis.set(redisTaskKey(task._id), JSON.stringify(task));
        return res.status(503).json({ message: task.error, task });
      }

      return res.status(201).json({ task });
    }

    const task = await Task.create({
      userId: req.user.sub,
      title: req.body.title,
      inputText: req.body.inputText,
      operation: req.body.operation,
      status: "pending",
      logs: [{ message: "Task created and queued" }]
    });

    try {
      await enqueueTask(task._id.toString());
    } catch (queueError) {
      task.status = "failed";
      task.error = "Queue unavailable. Try again later.";
      task.logs.push({ message: `Failed to enqueue task: ${queueError.message}` });
      task.finishedAt = new Date();
      await task.save();
      return res.status(503).json({ message: task.error, task });
    }

    return res.status(201).json({ task });
  } catch (error) {
    return next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    if (!mongoReady()) {
      const task = await getRedisTask(req.params.id);
      if (!task || task.userId !== req.user.sub) {
        return res.status(404).json({ message: "Task not found" });
      }

      return res.json({ task });
    }

    const task = await Task.findOne({ _id: req.params.id, userId: req.user.sub });
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    return res.json({ task });
  } catch (error) {
    return next(error);
  }
});

export default router;
