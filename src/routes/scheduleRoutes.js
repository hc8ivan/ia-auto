import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import * as scheduleController from "../controllers/scheduleController.js";

const router = Router();

router.get("/schedule", asyncHandler(scheduleController.getSchedule));

export default router;
