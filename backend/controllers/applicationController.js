import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Application from "../models/Application.js";
import { logAudit } from "../utils/auditLogger.js";
import {
  nextAppId,
  nextReferenceNumber,
  toEthiopianYear,
  updateReferenceNumberCounter,
} from "../utils/referenceNumber.js";
import { generateCertificatePdf } from "../utils/generateCertificatePdf.js";
import {
  resolveCertificatePdfPath,
  certificatePdfAbsolutePath,
} from "../utils/certificateFiles.js";
import {
  applicationRepresentation,
  certificateRepresentation,
  certificateSelfHref,
  collectionRepresentation,
  parsePagination,
  API_ROOT,
} from "../utils/representations.js";
import { sendStatusEmail } from "../utils/mailer.js";
import { broadcastSSE } from "../server.js";
import https from "https";

async function fetchTinInfo(tin) {
  try {
    const res = await fetch(
      `https://etrade.gov.et/api/Registration/GetRegistrationInfoByTin/${tin}/am`,
      {
        headers: {
          Referer: "https://etrade.gov.et",
          Origin: "https://etrade.gov.et",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Accept: "application/json",
        },
      },
    ).catch(() => null);
    if (!res || !res.ok) return await fetchTinInfoHttp(tin);
    const reg = await res.json();
    if (!reg?.Tin) return null;
    const associate = reg.AssociateShortInfos?.[0] || null;
    return {
      nameEn: (associate?.ManagerNameEng || reg.BusinessName || "").trim().toLowerCase(),
      nameAm: (associate?.ManagerNameAmh || reg.BusinessNameAmh || "").trim(),
      businessName: (reg.BusinessName || "").trim().toLowerCase(),
      businessNameAm: (reg.BusinessNameAmh || "").trim(),
    };
  } catch {
    return await fetchTinInfoHttp(tin);
  }
}

function fetchTinInfoHttp(tin) {
  return new Promise((resolve) => {
    const options = {
      hostname: "etrade.gov.et",
      path: `/api/Registration/GetRegistrationInfoByTin/${tin}/am`,
      method: "GET",
      rejectUnauthorized: false,
      headers: {
        Referer: "https://etrade.gov.et",
        Origin: "https://etrade.gov.et",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "application/json",
      },
    };
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        try {
          const reg = JSON.parse(data);
          if (!reg?.Tin) return resolve(null);
          const associate = reg.AssociateShortInfos?.[0] || null;
          resolve({
            nameEn: (associate?.ManagerNameEng || reg.BusinessName || "").trim().toLowerCase(),
            nameAm: (associate?.ManagerNameAmh || reg.BusinessNameAmh || "").trim(),
            businessName: (reg.BusinessName || "").trim().toLowerCase(),
            businessNameAm: (reg.BusinessNameAmh || "").trim(),
          });
        } catch {
          resolve(null);
        }
      });
    });
    req.on("error", () => resolve(null));
    req.end();
  });
}

function normaliseName(n) {
  return String(n || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function fileDoc(f) {
  if (!f) return null;
  return {
    name: f.originalname,
    path: `/uploads/${f.filename}`,
    mimeType: f.mimetype,
    size: f.size,
  };
}

export async function createApplication(req, res, next) {
  try {
    const data = JSON.parse(req.body.data || "{}");
    const {
      applicationType = "new",
      renewalOf,
      applicantInfo,
      hasTradeLicense,
      tin,
      businessName,
      serviceType,
    } = data;

    if (applicationType === "renewal") {
      if (!renewalOf?.trim()) {
        return res
          .status(400)
          .json({ message: "Reference number is required for renewal" });
      }

      const original = await Application.findOne({
        "certificate.referenceNumber": renewalOf.trim(),
        status: "certificate_generated",
      }).sort({ createdAt: -1 });
      if (!original) {
        return res.status(404).json({
          message: "No issued certificate found for that reference number",
        });
      }

      if (!original.applicant.equals(req.user._id)) {
        return res.status(403).json({
          message: "That certificate does not belong to your account",
        });
      }

      const pendingRenewal = await Application.findOne({
        applicant: req.user._id,
        renewalOf: renewalOf.trim(),
        status: { $in: ["staff_review", "admin_review", "admin_approved"] },
      });
      if (pendingRenewal) {
        return res.status(409).json({ message: "A renewal application is already pending for this certificate." });
      }

      const files = req.files || {};

      const app = await Application.create({
        appId: await nextAppId(),
        applicant: req.user._id,
        applicationType: "renewal",
        renewalOf: renewalOf.trim(),
        applicantInfo: applicantInfo || original.applicantInfo,
        hasTradeLicense: hasTradeLicense !== undefined ? !!hasTradeLicense : original.hasTradeLicense,
        tin: (hasTradeLicense !== undefined ? !!hasTradeLicense : original.hasTradeLicense) ? (tin || original.tin) : null,
        businessName: (hasTradeLicense !== undefined ? !!hasTradeLicense : original.hasTradeLicense) ? (businessName || original.businessName) : null,
        serviceType: serviceType || original.serviceType,
        documents: {
          photo: files.photo?.[0]
            ? fileDoc(files.photo[0])
            : original.documents?.photo,
          education: files.education?.[0]
            ? fileDoc(files.education[0])
            : original.documents?.education,
          competency: files.competency?.[0]
            ? fileDoc(files.competency[0])
            : original.documents?.competency,
          tradeLicense: files.tradeLicense?.[0]
            ? fileDoc(files.tradeLicense[0])
            : original.documents?.tradeLicense,
        },
      });

      broadcastSSE({ type: "application_update", id: app.appId });
      return res
        .status(201)
        .location(`${API_ROOT}/applications/${app.appId}`)
        .json(applicationRepresentation(app, { requester: req.user }));
    }

    if (
      !applicantInfo?.gender ||
      !applicantInfo?.phone ||
      !applicantInfo?.address?.region ||
      !applicantInfo?.address?.woreda ||
      !applicantInfo?.address?.kebele
    ) {
      return res
        .status(400)
        .json({ message: "Missing required applicant fields" });
    }
    if (!serviceType?.id) {
      return res.status(400).json({ message: "A service type is required" });
    }

    const files = req.files || {};
    if (!files.photo || !files.education) {
      return res
        .status(400)
        .json({ message: "Photo and education certificate are required" });
    }
    if (hasTradeLicense && !files.tradeLicense) {
      return res
        .status(400)
        .json({ message: "Trade license document is required" });
    }

    let tinVerified = false;
    if (hasTradeLicense && tin?.trim()) {
      const tinInfo = await fetchTinInfo(tin.trim());
      if (tinInfo === null) {
        return res.status(422).json({
          message: "Could not verify TIN with the government registry. Please check the TIN number and try again.",
          code: "TIN_UNREACHABLE",
        });
      }
      const submittedBusiness = normaliseName(businessName || "");
      if (submittedBusiness) {
        const matchEn =
          tinInfo.businessName &&
          (tinInfo.businessName.includes(submittedBusiness) ||
            submittedBusiness.includes(tinInfo.businessName));
        const matchAm =
          tinInfo.businessNameAm &&
          (normaliseName(tinInfo.businessNameAm).includes(submittedBusiness) ||
            submittedBusiness.includes(normaliseName(tinInfo.businessNameAm)));
        if (!matchEn && !matchAm) {
          return res.status(422).json({
            message: "The business name you entered does not match the government registry for this TIN. Please check your business name.",
            code: "TIN_BUSINESS_MISMATCH",
          });
        }
      }
      tinVerified = true;
    }

    const pendingApp = await Application.findOne({
      applicant: req.user._id,
      "serviceType.id": serviceType.id,
      status: { $in: ["staff_review", "admin_review", "admin_approved"] },
    });
    if (pendingApp) {
      return res.status(409).json({ message: "You already have an active or pending application for this service type." });
    }

    const app = await Application.create({
      appId: await nextAppId(),
      applicant: req.user._id,
      applicationType: "new",
      applicantInfo,
      hasTradeLicense: !!hasTradeLicense,
      tin: hasTradeLicense ? tin || null : null,
      businessName: hasTradeLicense ? businessName || null : null,
      tinVerified,
      serviceType,
      documents: {
        photo: fileDoc(files.photo?.[0]),
        education: fileDoc(files.education?.[0]),
        tradeLicense: fileDoc(files.tradeLicense?.[0]),
        others: (files.others || []).map(fileDoc),
      },
    });

    broadcastSSE({ type: "application_update", id: app.appId });
    res
      .status(201)
      .location(`${API_ROOT}/applications/${app.appId}`)
      .json(applicationRepresentation(app, { requester: req.user }));
  } catch (err) {
    next(err);
  }
}

export async function getApplications(req, res, next) {
  try {
    const filter =
      req.user.role === "applicant" ? { applicant: req.user._id } : {};
    if (req.query.status) filter.status = req.query.status;

    const { page, limit, skip } = parsePagination(req);
    const [apps, total] = await Promise.all([
      Application.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Application.countDocuments(filter),
    ]);

    res.set("Cache-Control", "private, no-cache");
    res.json(
      collectionRepresentation(res, {
        items: apps.map((a) =>
          applicationRepresentation(a, { requester: req.user }),
        ),
        page,
        limit,
        total,
        baseHref: `${API_ROOT}/applications`,
      }),
    );
  } catch (err) {
    next(err);
  }
}

async function findAuthorized(req, res) {
  const app = await Application.findOne({ appId: req.params.id });
  if (!app) {
    res.status(404).json({ message: "Application not found" });
    return null;
  }
  if (req.user.role === "applicant" && !app.applicant.equals(req.user._id)) {
    res.status(404).json({ message: "Application not found" });
    return null;
  }
  return app;
}

export async function getApplication(req, res, next) {
  try {
    const app = await findAuthorized(req, res);
    if (!app) return;
    res.set("Cache-Control", "private, no-cache");
    res.json(applicationRepresentation(app, { requester: req.user }));
  } catch (err) {
    next(err);
  }
}

export async function patchApplication(req, res, next) {
  try {
    const app = await findAuthorized(req, res);
    if (!app) return;

    if (req.user.role === "admin") {
      const { applicantInfo, tin, businessName, hasTradeLicense } = req.body;
      let changed = false;
      if (applicantInfo) {
        if (applicantInfo.fullName !== undefined) app.applicantInfo.fullName = applicantInfo.fullName;
        if (applicantInfo.gender !== undefined) app.applicantInfo.gender = applicantInfo.gender;
        if (applicantInfo.phone !== undefined) app.applicantInfo.phone = applicantInfo.phone;
        if (applicantInfo.dob !== undefined) app.applicantInfo.dob = applicantInfo.dob;
        
        if (applicantInfo.address) {
          if (!app.applicantInfo.address) app.applicantInfo.address = {};
          if (applicantInfo.address.region !== undefined) app.applicantInfo.address.region = applicantInfo.address.region;
          if (applicantInfo.address.woreda !== undefined) app.applicantInfo.address.woreda = applicantInfo.address.woreda;
          if (applicantInfo.address.kebele !== undefined) app.applicantInfo.address.kebele = applicantInfo.address.kebele;
          if (applicantInfo.address.houseNo !== undefined) app.applicantInfo.address.houseNo = applicantInfo.address.houseNo;
          if (applicantInfo.address.poBox !== undefined) app.applicantInfo.address.poBox = applicantInfo.address.poBox;
          if (applicantInfo.address.fax !== undefined) app.applicantInfo.address.fax = applicantInfo.address.fax;
          if (applicantInfo.address.email !== undefined) app.applicantInfo.address.email = applicantInfo.address.email;
          if (applicantInfo.address.licenseOwnerAddress !== undefined) app.applicantInfo.address.licenseOwnerAddress = applicantInfo.address.licenseOwnerAddress;
        }
        changed = true;
      }
      if (tin !== undefined) {
        if (tin && tin.trim() !== "") {
          const trimmedTin = tin.trim();
          if (trimmedTin !== app.tin) {
            const tinInfo = await fetchTinInfo(trimmedTin);
            if (tinInfo === null) {
              return res.status(422).json({
                message: "Invalid TIN: Could not verify this TIN number with the government registry. Please check the number.",
                code: "TIN_UNREACHABLE",
              });
            }
            app.tinVerified = true;
          }
          app.tin = trimmedTin;
        } else {
          app.tin = null;
          app.tinVerified = false;
        }
        changed = true;
      }
      if (businessName !== undefined) { app.businessName = businessName; changed = true; }
      if (hasTradeLicense !== undefined) { app.hasTradeLicense = hasTradeLicense; changed = true; }
      
      if (changed) {
        await app.save({ validateBeforeSave: false });
        broadcastSSE({ type: "application_update", id: app.appId });
      }
      return res.json(applicationRepresentation(app, { requester: req.user }));
    }

    const { status } = req.body;
    if (status !== "withdrawn") {
      return res
        .status(400)
        .json({ message: 'Only { "status": "withdrawn" } is supported' });
    }
    if (req.user.role !== "applicant") {
      return res
        .status(403)
        .json({ message: "Only the applicant can withdraw" });
    }
    if (app.status === "withdrawn") {
      return res.json(applicationRepresentation(app, { requester: req.user }));
    }
    if (app.status !== "staff_review") {
      return res.status(409).json({
        message: "Only applications still in staff review can be withdrawn",
      });
    }

    app.status = "withdrawn";
    await app.save();
    broadcastSSE({ type: "application_update", id: app.appId });
    res.json(applicationRepresentation(app, { requester: req.user }));
  } catch (err) {
    next(err);
  }
}

export async function createDecision(req, res, next) {
  try {
    const { decision, reason } = req.body;
    if (!["approved", "rejected"].includes(decision)) {
      return res
        .status(400)
        .json({ message: "Decision must be approved or rejected" });
    }
    if (decision === "rejected" && !reason?.trim()) {
      return res
        .status(400)
        .json({ message: "A reason is required to reject" });
    }

    const app = await Application.findOne({ appId: req.params.id });
    if (!app) return res.status(404).json({ message: "Application not found" });

    const record = {
      by: req.user._id,
      byName: req.user.fullName || req.user.username,
      decision,
      reason: reason || "",
      at: new Date(),
    };

    if (req.user.role === "staff") {
      if (app.status !== "staff_review") {
        return res
          .status(409)
          .json({ message: "This application is not awaiting staff review" });
      }
      app.status = decision === "approved" ? "admin_review" : "staff_rejected";
      app.staffDecision = record;
    } else if (req.user.role === "admin") {
      if (app.status !== "admin_review") {
        return res
          .status(409)
          .json({ message: "This application is not awaiting admin review" });
      }
      app.status =
        decision === "approved" ? "admin_approved" : "admin_rejected";
      app.adminDecision = record;
    } else {
      return res.status(403).json({ message: "Not allowed" });
    }

    await app.save();

    await logAudit(req, `DECISION_${decision.toUpperCase()}`, "Application", app.appId, {
      role: req.user.role === "staff" ? "staff" : "admin",
      newStatus: app.status,
      reason: record.reason
    });

    broadcastSSE({ type: "application_update", id: app.appId });

    const applicantEmail = app.applicantInfo?.address?.email;
    if (applicantEmail) {
      sendStatusEmail(
        applicantEmail,
        app.applicantInfo.fullName,
        app.status,
        null,
        record.reason || null,
      ).catch(() => {});
    }

    res
      .status(201)
      .location(`${API_ROOT}/applications/${app.appId}/decisions`)
      .json(applicationRepresentation(app, { requester: req.user }));
  } catch (err) {
    next(err);
  }
}

export async function getDecisions(req, res, next) {
  try {
    const app = await findAuthorized(req, res);
    if (!app) return;

    const items = [];
    if (app.staffDecision)
      items.push({ stage: "staff", ...app.staffDecision.toObject() });
    if (app.adminDecision)
      items.push({ stage: "admin", ...app.adminDecision.toObject() });

    res.set("Cache-Control", "private, no-cache");
    res.json({
      items,
      _links: {
        self: { href: `${API_ROOT}/applications/${app.appId}/decisions` },
        application: { href: `${API_ROOT}/applications/${app.appId}` },
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function createCertificate(req, res, next) {
  try {
    const app = await Application.findOne({ appId: req.params.id });
    if (!app) return res.status(404).json({ message: "Application not found" });

    if (app.status === "certificate_generated") {
      res.set("Location", certificateSelfHref(app.certificate.referenceNumber));
      return res.status(409).json({ message: "Certificate already generated" });
    }
    if (app.status !== "admin_approved") {
      return res.status(409).json({
        message: "Certificate can only be generated after admin approval",
      });
    }

    let year = toEthiopianYear();
    const adminName = req.user.fullName || req.user.username;

    const issuedAt = new Date();

    if (app.applicationType === "renewal" && app.renewalOf) {
      const oldRefNumber = app.renewalOf;
      const [seq] = oldRefNumber.split("/");
      
      const originalApp = await Application.findOne({
        "certificate.referenceNumber": oldRefNumber,
        status: "certificate_generated"
      }).sort({ createdAt: -1 });

      if (originalApp && originalApp.certificate?.latestYear) {
        year = Math.max(year, originalApp.certificate.latestYear + 1);
      }

      const newRefNumber = `${seq}/${year}`;

      app.status = "certificate_generated";
      app.certificate = {
        referenceNumber: newRefNumber,
        history: {
          ...(originalApp?.certificate?.history?.toObject?.() || originalApp?.certificate?.history || {}),
          [year]: { issuedAt, adminName, pdfPath: null },
        },
        latestYear: year,
        issuedAt,
        adminName,
        pdfPath: null,
      };
    } else {
      const refNumber = await nextReferenceNumber();
      app.status = "certificate_generated";
      app.certificate = {
        referenceNumber: refNumber,
        history: { [year]: { issuedAt, adminName, pdfPath: null } },
        latestYear: year,
        issuedAt,
        adminName,
        pdfPath: null,
      };
    }

    try {
      const pdfPath = await generateCertificatePdf(app, year);
      app.certificate.pdfPath = pdfPath;
      if (app.certificate.history) {
        if (typeof app.certificate.history.set === "function") {
          app.certificate.history.set(String(year), {
            issuedAt,
            adminName,
            pdfPath,
          });
        } else {
          app.certificate.history[String(year)] = {
            issuedAt,
            adminName,
            pdfPath,
          };
        }
      }
    } catch (pdfErr) {
      console.error("PDF generation failed:", pdfErr);
      throw new Error(`PDF generation failed: ${pdfErr instanceof Error ? pdfErr.message : String(pdfErr)}`);
    }

    await app.save();

    await logAudit(req, "CERTIFICATE_GENERATED", "Application", app.appId, {
      referenceNumber: app.certificate.referenceNumber,
      year: year
    });

    broadcastSSE({ type: "application_update", id: app.appId });

    const applicantEmail = app.applicantInfo?.address?.email;
    if (applicantEmail) {
      sendStatusEmail(
        applicantEmail,
        app.applicantInfo.fullName,
        "certificate_generated",
        app.certificate.referenceNumber,
      ).catch(() => {});
    }

    res
      .status(201)
      .location(certificateSelfHref(app.certificate.referenceNumber))
      .json(applicationRepresentation(app, { requester: req.user }));
  } catch (err) {
    next(err);
  }
}

export async function getCertificate(req, res, next) {
  try {
    const refNumber = `${req.params.seq}/${req.params.year}`;
    const app = await Application.findOne({
      "certificate.referenceNumber": refNumber,
      status: "certificate_generated",
    }).sort({ createdAt: -1 });
    if (!app) {
      res.set("Cache-Control", "no-store");
      return res
        .status(404)
        .json({ valid: false, message: "Certificate not found" });
    }

    res.set("Cache-Control", "public, max-age=3600");
    res.json(certificateRepresentation(app));
  } catch (err) {
    next(err);
  }
}

export async function downloadCertificatePdf(req, res, next) {
  try {
    const app = await Application.findOne({ appId: req.params.id });
    if (!app) {
      return res.status(404).json({ message: "Application not found" });
    }

    if (req.user.role === "applicant" && !app.applicant.equals(req.user._id)) {
      return res
        .status(404)
        .json({ message: "Application not found" });
    }

    if (
      !["certificate_generated", "expired"].includes(app.status) ||
      !app.certificate?.referenceNumber
    ) {
      return res
        .status(409)
        .json({ message: "Certificate has not been issued yet" });
    }

    const year = req.query.year ? parseInt(req.query.year, 10) : null;
    const relativePath = resolveCertificatePdfPath(app, Number.isFinite(year) ? year : null);
    if (!relativePath) {
      return res
        .status(404)
        .json({ message: "Certificate PDF is not available" });
    }

    const absolutePath = certificatePdfAbsolutePath(relativePath);
    if (!absolutePath) {
      return res
        .status(404)
        .json({ message: "Certificate PDF is not available" });
    }

    const filename = path.basename(absolutePath);
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    });
    res.sendFile(absolutePath);
  } catch (err) {
    next(err);
  }
}

export async function renewalLookup(req, res, next) {
  try {
    const ref = req.query.ref?.trim();
    if (!ref)
      return res.status(400).json({ message: "ref query param is required" });

    const app = await Application.findOne({
      "certificate.referenceNumber": ref,
      status: "certificate_generated",
    }).sort({ createdAt: -1 });
    if (!app) {
      return res.status(404).json({
        message: "No issued certificate found for that reference number",
      });
    }
    if (!app.applicant.equals(req.user._id)) {
      return res
        .status(403)
        .json({ message: "That certificate does not belong to your account" });
    }

    res.json({
      referenceNumber: ref,
      holderName: app.applicantInfo.fullName,
      serviceType: app.serviceType,
      latestYear: app.certificate.latestYear,
      applicantInfo: app.applicantInfo,
      hasTradeLicense: app.hasTradeLicense,
      tin: app.tin,
      businessName: app.businessName,
      history: Object.fromEntries(
        Object.entries(app.certificate.history?.toObject?.() || {}).map(
          ([y, v]) => [y, { issuedAt: v.issuedAt, adminName: v.adminName }],
        ),
      ),
    });
  } catch (err) {
    next(err);
  }
}

export async function sendCertificateEmail(req, res, next) {
  try {
    const app = await Application.findOne({ appId: req.params.id });
    if (!app) return res.status(404).json({ message: "Application not found" });
    if (app.status !== "certificate_generated") {
      return res
        .status(409)
        .json({ message: "Certificate has not been generated yet" });
    }

    const applicantEmail = app.applicantInfo?.address?.email;
    if (!applicantEmail) {
      return res
        .status(422)
        .json({ message: "Applicant has no email address on record" });
    }

    const latestYear = app.certificate?.latestYear || toEthiopianYear();
    
    let pdfPath;
    try {
      pdfPath = await generateCertificatePdf(app, latestYear);
      app.certificate.pdfPath = pdfPath;
      if (app.certificate.history?.get) {
        const hObj = app.certificate.history.get(String(latestYear)) || {};
        app.certificate.history.set(String(latestYear), { ...hObj, pdfPath });
      }
      await app.save();
    } catch (genErr) {
      console.error("PDF re-generation error:", genErr);
      const histObj = app.certificate?.history?.toObject
        ? app.certificate.history.toObject()
        : app.certificate?.history || {};
      pdfPath = histObj[String(latestYear)]?.pdfPath || app.certificate?.pdfPath;
      if (!pdfPath) {
        return res
          .status(500)
          .json({ message: `PDF generation failed: ${genErr instanceof Error ? genErr.message : String(genErr)}` });
      }
    }

    if (!pdfPath) {
      return res
        .status(409)
        .json({ message: "PDF not available for this certificate" });
    }

    const localPath = pdfPath.startsWith("/uploads/")
      ? path.join(path.dirname(fileURLToPath(import.meta.url)), "..", pdfPath)
      : pdfPath;
    if (!fs.existsSync(localPath))
      return res.status(409).json({ message: "PDF file not found on server" });
    const pdfBuffer = fs.readFileSync(localPath);

    const { sendCertificateEmailNotification } = await import("../utils/mailer.js");
    await sendCertificateEmailNotification({
      to: applicantEmail,
      applicantName: app.applicantInfo?.fullName || "Applicant",
      referenceNumber: app.certificate.referenceNumber,
      pdfBuffer,
    });

    res.json({ message: "Certificate sent to " + applicantEmail });
  } catch (err) {
    next(err);
  }
}

export async function importLegacyApplication(req, res, next) {
  try {
    const data = JSON.parse(req.body.data || "{}");
    const { applicantInfo, hasTradeLicense, tin, businessName, serviceType, referenceNumber, issueDate } = data;

    if (!referenceNumber || !issueDate) {
      return res.status(400).json({ message: "Reference number and issue date are required for legacy import" });
    }

    if (
      !applicantInfo?.fullName ||
      !applicantInfo?.gender ||
      !applicantInfo?.phone ||
      !applicantInfo?.address?.region ||
      !applicantInfo?.address?.woreda ||
      !applicantInfo?.address?.kebele
    ) {
      return res.status(400).json({ message: "Missing required applicant fields" });
    }

    if (!serviceType?.id) {
      return res.status(400).json({ message: "A service type is required" });
    }

    let user = await import("../models/User.js").then(m => m.default).then(User => User.findOne({ phone: applicantInfo.phone }));
    
    if (!user) {
      const User = (await import("../models/User.js")).default;
      const username = applicantInfo.phone;
      const password = await import("bcryptjs").then(m => m.hash(applicantInfo.phone, 10));
      user = await User.create({
        username,
        email: applicantInfo.address.email || null,
        phone: applicantInfo.phone,
        password,
        role: "applicant",
        fullName: applicantInfo.fullName
      });
    }

    const files = req.files || {};
    
    let tinVerified = false;
    if (hasTradeLicense && tin?.trim()) {
      const tinInfo = await fetchTinInfo(tin.trim());
      if (tinInfo !== null) {
        tinVerified = true;
      }
    }

    const issuedAt = new Date(issueDate);
    const yearStr = referenceNumber.split("/")[1] || toEthiopianYear(issuedAt).toString();
    const year = parseInt(yearStr, 10);
    const adminName = req.user.fullName || req.user.username;

    const app = await Application.create({
      appId: await nextAppId(),
      applicant: user._id,
      applicationType: "new",
      applicantInfo,
      hasTradeLicense: !!hasTradeLicense,
      tin: hasTradeLicense ? tin || null : null,
      businessName: hasTradeLicense ? businessName || null : null,
      tinVerified,
      serviceType,
      status: "certificate_generated",
      documents: {
        photo: fileDoc(files.photo?.[0]),
        education: fileDoc(files.education?.[0]),
        tradeLicense: fileDoc(files.tradeLicense?.[0]),
        others: (files.others || []).map(fileDoc),
      },
      certificate: {
        referenceNumber: referenceNumber,
        history: { [year]: { issuedAt, adminName, pdfPath: null } },
        latestYear: year,
        issuedAt,
        adminName,
        pdfPath: null,
      },
      submittedAt: issuedAt
    });

    try {
      const pdfPath = await generateCertificatePdf(app, year);
      app.certificate.pdfPath = pdfPath;
      app.certificate.history.get
        ? app.certificate.history.set(String(year), { issuedAt, adminName, pdfPath })
        : (app.certificate.history[String(year)] = { issuedAt, adminName, pdfPath });
      await app.save();
    } catch (pdfErr) {
      console.error("Legacy PDF generation failed:", pdfErr);
      throw new Error(
        `Certificate PDF generation failed: ${pdfErr instanceof Error ? pdfErr.message : String(pdfErr)}`
      );
    }

    await updateReferenceNumberCounter(referenceNumber);

    await logAudit(req, "IMPORT_LEGACY_CERTIFICATE", "Application", app.appId, {
      referenceNumber,
      applicantPhone: applicantInfo.phone,
    });

    broadcastSSE({ type: "application_update", id: app.appId });
    res
      .status(201)
      .location(`${API_ROOT}/applications/${app.appId}`)
      .json(applicationRepresentation(app, { requester: req.user }));
  } catch (err) {
    next(err);
  }
}
