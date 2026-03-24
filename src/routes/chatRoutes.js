import { Router } from "express";
import rateLimit from "express-rate-limit";
import { config } from "../config/env.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { validateChatBody } from "../middleware/validateChatBody.js";
import { validateSessionIdParam } from "../middleware/validateSessionIdParam.js";
import * as chatController from "../controllers/chatController.js";

const router = Router();

const chatLimiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiadas peticiones. Inténtalo en unos minutos." },
});

router.use(chatLimiter);

router.get(
  "/chat/session/:sessionId",
  validateSessionIdParam,
  asyncHandler(chatController.getSessionMessages),
);

router.post(
  "/chat",
  validateChatBody,
  asyncHandler(chatController.postChat),
);

export default router;
