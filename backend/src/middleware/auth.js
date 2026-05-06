import jwt from "jsonwebtoken";
import { config } from "../config.js";

export function requireAuth(req, res, next) {
  const header = req.get("authorization");

  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Missing bearer token" });
  }

  try {
    const token = header.slice("Bearer ".length);
    req.user = jwt.verify(token, config.jwtSecret);
    return next();
  } catch (_error) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}
