import express from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { Task } from "../models/Task.js";
import { enqueueTask } from "../queue.js";

const router = express.Router();

const createTaskSchema = z.object({
  title: z.string().min(1).max(120),
  inputText: z.string().min(1).max(10000),
  operation: z.enum(["uppercase", "lowercase", "reverse", "word_count"])
});

router.use(requireAuth);

router.get("/", async (req, res, next) => {
  try {
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
