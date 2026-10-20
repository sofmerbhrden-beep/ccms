import { Router } from "express";
import {
  getServiceTypes,
  getServiceType,
  createServiceType,
  updateServiceType,
  deleteServiceType,
} from "../controllers/serviceTypeController.js";
import { protect, identify, requireRole } from "../middleware/authMiddleware.js";
import { methodNotAllowed } from "../middleware/methodNotAllowed.js";
import { validateRequest } from "../middleware/validateRequest.js";
import { createServiceTypeSchema, updateServiceTypeSchema } from "../validator/serviceTypeValidator.js";

const router = Router();

router.use(identify);

router
  .route("/")
  .get(getServiceTypes)
  .post(protect, requireRole("admin"), validateRequest(createServiceTypeSchema), createServiceType)
  .all(methodNotAllowed("GET, POST"));

router
  .route("/:stId")
  .get(getServiceType)
  .patch(protect, requireRole("admin"), validateRequest(updateServiceTypeSchema), updateServiceType)
  .delete(protect, requireRole("admin"), deleteServiceType)
  .all(methodNotAllowed("GET, PATCH, DELETE"));

export default router;
