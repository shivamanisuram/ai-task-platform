import bcrypt from "bcryptjs";
import crypto from "crypto";
import express from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { z } from "zod";
import { config } from "../config.js";
import { validate } from "../middleware/validate.js";
import { User } from "../models/User.js";
import { redis } from "../queue.js";

const router = express.Router();

const registerSchema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email().max(160),
  password: z.string().min(8).max(128)
});

const loginSchema = z.object({
  email: z.string().email().max(160),
  password: z.string().min(1).max(128)
});

function signToken(user) {
  return jwt.sign(
    {
      sub: (user._id || user.id).toString(),
      email: user.email,
      name: user.name
    },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );
}

function mongoReady() {
  return mongoose.connection.readyState === 1;
}

function publicUser(user) {
  return { id: (user._id || user.id).toString(), name: user.name, email: user.email };
}

async function findRedisUser(email) {
  const raw = await redis.get(`user:email:${email.toLowerCase()}`);
  return raw ? JSON.parse(raw) : null;
}

router.post("/register", validate(registerSchema), async (req, res, next) => {
  try {
    if (!mongoReady()) {
      const email = req.body.email.toLowerCase();
      const existing = await findRedisUser(email);
      if (existing) {
        return res.status(409).json({ message: "Email is already registered" });
      }

      const user = {
        id: crypto.randomUUID(),
        name: req.body.name,
        email,
        passwordHash: await bcrypt.hash(req.body.password, 12),
        createdAt: new Date().toISOString()
      };
      await redis.set(`user:email:${email}`, JSON.stringify(user));
      await redis.set(`user:id:${user.id}`, JSON.stringify(user));

      return res.status(201).json({ token: signToken(user), user: publicUser(user) });
    }

    const existing = await User.findOne({ email: req.body.email });
    if (existing) {
      return res.status(409).json({ message: "Email is already registered" });
    }

    const passwordHash = await bcrypt.hash(req.body.password, 12);
    const user = await User.create({
      name: req.body.name,
      email: req.body.email,
      passwordHash
    });

    return res.status(201).json({
      token: signToken(user),
      user: publicUser(user)
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/login", validate(loginSchema), async (req, res, next) => {
  try {
    const user = mongoReady() ? await User.findOne({ email: req.body.email }) : await findRedisUser(req.body.email);
    const valid = user ? await bcrypt.compare(req.body.password, user.passwordHash) : false;

    if (!valid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    return res.json({
      token: signToken(user),
      user: publicUser(user)
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
