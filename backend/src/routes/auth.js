import bcrypt from "bcryptjs";
import express from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { config } from "../config.js";
import { validate } from "../middleware/validate.js";
import { User } from "../models/User.js";

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
      sub: user._id.toString(),
      email: user.email,
      name: user.name
    },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );
}

router.post("/register", validate(registerSchema), async (req, res, next) => {
  try {
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
      user: { id: user._id, name: user.name, email: user.email }
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/login", validate(loginSchema), async (req, res, next) => {
  try {
    const user = await User.findOne({ email: req.body.email });
    const valid = user ? await bcrypt.compare(req.body.password, user.passwordHash) : false;

    if (!valid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    return res.json({
      token: signToken(user),
      user: { id: user._id, name: user.name, email: user.email }
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
