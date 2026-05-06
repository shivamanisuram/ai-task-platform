import mongoose from "mongoose";

const taskLogSchema = new mongoose.Schema(
  {
    message: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
  },
  { _id: false }
);

const taskSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120
    },
    inputText: {
      type: String,
      required: true,
      maxlength: 10000
    },
    operation: {
      type: String,
      enum: ["uppercase", "lowercase", "reverse", "word_count"],
      required: true
    },
    status: {
      type: String,
      enum: ["pending", "running", "success", "failed"],
      default: "pending",
      index: true
    },
    result: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    error: {
      type: String,
      default: null
    },
    logs: {
      type: [taskLogSchema],
      default: []
    },
    startedAt: Date,
    finishedAt: Date
  },
  { timestamps: true }
);

taskSchema.index({ userId: 1, createdAt: -1 });
taskSchema.index({ status: 1, createdAt: 1 });

export const Task = mongoose.model("Task", taskSchema);
