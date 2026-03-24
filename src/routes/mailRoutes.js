import { Router } from "express";
import * as mailController from "../controllers/mailController.js";

const router = Router();

router.get("/mail/status", mailController.getMailStatus);

export default router;
