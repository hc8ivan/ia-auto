import { Router } from "express";
import rateLimit from "express-rate-limit";
import { requireAdminKey } from "../middleware/requireAdminKey.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import * as adminController from "../controllers/adminController.js";

const router = Router();

const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiadas peticiones al panel de administración." },
});

router.use(adminLimiter);
router.use(requireAdminKey);

router.get(
  "/admin/reservations",
  asyncHandler(adminController.listReservationsInRange),
);
router.get(
  "/admin/reservations/summary",
  asyncHandler(adminController.getReservationsSummary),
);
router.get(
  "/admin/reservations/export.csv",
  asyncHandler(adminController.exportReservationsCsv),
);

router.post("/admin/mail/test", asyncHandler(adminController.postMailTest));

export default router;
