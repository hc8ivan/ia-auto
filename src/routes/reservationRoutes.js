import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import * as reservationController from "../controllers/reservationController.js";

const router = Router();

router.get(
  "/availability",
  asyncHandler(reservationController.getAvailability),
);

export default router;
