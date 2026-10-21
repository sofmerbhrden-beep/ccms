import path from "path";

/**
 * Certificate PDFs must only be served through the authenticated
 * `GET /api/v1/applications/:id/certificate/pdf` endpoint, which verifies
 * ownership, issuance status and the requested year.
 *
 * The static `/uploads` route is still used for applicant uploaded documents
 * (photos, education files, ...), so only certificate PDFs are blocked here.
 */
export function blockCertificatePdfStaticAccess(req, res, next) {
  const requested = path.basename(req.path || "");
  if (/^cert-.*\.pdf$/i.test(requested)) {
    return res.status(404).json({
      message: "Certificate files are not served directly. Use the certificate PDF endpoint.",
    });
  }
  next();
}
