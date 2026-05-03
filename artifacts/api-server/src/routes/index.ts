import { Hono } from "hono";
import healthRouter from "./health";
import authRouter from "./auth";
import platformsRouter from "./platforms";
import campaignsRouter from "./campaigns";
import publishRouter from "./publish";
import mediaRouter from "./media";
import logsRouter from "./logs";
import dashboardRouter from "./dashboard";
import aiRouter from "./ai";

const router = new Hono();

router.route("/", healthRouter);
router.route("/", authRouter);
router.route("/", platformsRouter);
router.route("/", campaignsRouter);
router.route("/", publishRouter);
router.route("/", mediaRouter);
router.route("/", logsRouter);
router.route("/", dashboardRouter);
router.route("/", aiRouter);

export default router;
