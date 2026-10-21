import { Router } from "express";
import {
  createApplication,
  getApplications,
  getApplication,
  patchApplication,
  createDecision,
  getDecisions,
  createCertificate,
  sendCertificateEmail,
  downloadCertificatePdf,
  renewalLookup,
  importLegacyApplication,
} from "../controllers/applicationController.js";
import { protect, requireRole } from "../middleware/authMiddleware.js";
import { uploadDocuments } from "../middleware/uploadMiddleware.js";
import { methodNotAllowed } from "../middleware/methodNotAllowed.js";
import { validateRequest, validateFormData } from "../middleware/validateRequest.js";
import { reviewApplicationSchema, createApplicationSchema } from "../validator/applicationValidator.js";

const router = Router();

router.use(protect);

router.route("/renewal-lookup").get(renewalLookup).all(methodNotAllowed("GET"));

router
  .route("/legacy")
  .post(requireRole("admin"), uploadDocuments, importLegacyApplication)
  .all(methodNotAllowed("POST"));

router
  .route("/")
  .get(getApplications)
  .post(requireRole("applicant"), uploadDocuments, validateFormData(createApplicationSchema), createApplication)
  .all(methodNotAllowed("GET, POST"));

router
  .route("/:id")
  .get(getApplication)
  .patch(patchApplication)
  .all(methodNotAllowed("GET, PATCH"));

router
  .route("/:id/decisions")
  .get(getDecisions)
  .post(requireRole("staff", "admin"), validateRequest(reviewApplicationSchema), createDecision)
  .all(methodNotAllowed("GET, POST"));

router
  .route("/:id/certificate")
  .post(requireRole("admin"), createCertificate)
  .all(methodNotAllowed("POST"));

router
  .route("/:id/certificate/send")
  .post(requireRole("admin"), sendCertificateEmail)
  .all(methodNotAllowed("POST"));

router
  .route("/:id/certificate/pdf")
  .get(downloadCertificatePdf)
  .all(methodNotAllowed("GET"));

export default router;
