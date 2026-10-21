import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const UPLOADS_DIR = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.join(__dirname, "../uploads");

/**
 * Returns the stored relative path of the certificate PDF (e.g. "/uploads/cert-APP-1001-2018.pdf")
 * for an application, or null when no PDF has been generated yet.
 *
 * When `year` is provided, the history entry for that year is preferred.
 */
export function resolveCertificatePdfPath(app, year) {
  const cert = app?.certificate;
  if (!cert) return null;

  const histObj = cert.history?.toObject
    ? cert.history.toObject()
    : cert.history || {};

  const candidates = [];
  if (year) {
    const yearEntry = histObj[String(year)];
    if (yearEntry) {
      // A specific year was requested: never fall back to another year's file.
      if (yearEntry.pdfPath) candidates.push(yearEntry.pdfPath);
    } else {
      candidates.push(cert.pdfPath);
    }
  } else {
    if (cert.pdfPath) candidates.push(cert.pdfPath);
    if (cert.latestYear && histObj[String(cert.latestYear)]?.pdfPath) {
      candidates.push(histObj[String(cert.latestYear)].pdfPath);
    }
  }

  for (const candidate of candidates) {
    if (candidate && certificatePdfAbsolutePath(candidate)) {
      return candidate;
    }
  }
  return null;
}

/**
 * Maps a stored relative path to an absolute path inside the uploads directory.
 * Returns null when the path is missing, unsafe, or the file does not exist.
 */
export function certificatePdfAbsolutePath(relativePath) {
  if (!relativePath || typeof relativePath !== "string") return null;

  const filename = path.basename(relativePath);
  if (!filename.toLowerCase().endsWith(".pdf")) return null;

  const absolute = path.join(UPLOADS_DIR, filename);
  if (!fs.existsSync(absolute)) return null;
  return absolute;
}
