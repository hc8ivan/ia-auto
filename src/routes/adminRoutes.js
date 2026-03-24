import { Router } from "express";
import { requireAdminKey } from "../middleware/requireAdminKey.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import * as adminController from "../controllers/adminController.js";

const router = Router();

router.use(requireAdminKey);

router.get(
  "/admin/reservations",
  asyncHandler(adminController.listReservationsInRange),
);

router.post("/admin/mail/test", asyncHandler(adminController.postMailTest));

export default router;
