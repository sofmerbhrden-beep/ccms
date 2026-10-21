import request from "supertest";
import express from "express";
import fs from "fs";
import os from "os";
import path from "path";
import { jest } from "@jest/globals";
import { blockCertificatePdfStaticAccess } from "../middleware/certificateStaticGuard.js";

const uploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), "ccms-cert-test-"));
process.env.UPLOADS_DIR = uploadsDir;

const app = express();
app.use(express.json());

let currentUser = { _id: "507f1f77bcf86cd799439011", role: "applicant" };

jest.unstable_mockModule("../middleware/authMiddleware.js", () => ({
  protect: (req, res, next) => {
    req.user = currentUser;
    next();
  },
  requireRole: (...roles) => (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    next();
  },
}));

jest.unstable_mockModule("../middleware/validateRequest.js", () => ({
  validateRequest: () => (req, res, next) => next(),
  validateFormData: () => (req, res, next) => next(),
}));

jest.unstable_mockModule("../middleware/uploadMiddleware.js", () => ({
  uploadDocuments: (req, res, next) => next(),
}));

const mockFindOne = jest.fn();
jest.unstable_mockModule("../models/Application.js", () => ({
  default: {
    findOne: mockFindOne,
    countDocuments: jest.fn().mockResolvedValue(0),
  },
}));

jest.unstable_mockModule("../server.js", () => ({
  broadcastSSE: () => {},
}));

const OWNER_ID = "507f1f77bcf86cd799439011";
const OTHER_ID = "507f1f77bcf86cd799439099";

function makeApp(overrides = {}) {
  return {
    appId: "APP-9001",
    applicant: {
      _id: OWNER_ID,
      equals: (other) => String(other) === OWNER_ID,
    },
    status: "certificate_generated",
    applicantInfo: { fullName: "Test Applicant" },
    certificate: {
      referenceNumber: "1/2018",
      latestYear: 2018,
      issuedAt: new Date("2018-01-01"),
      adminName: "Admin",
      pdfPath: "/uploads/cert-APP-9001-2018.pdf",
      history: {
        2018: { issuedAt: new Date("2018-01-01"), adminName: "Admin", pdfPath: "/uploads/cert-APP-9001-2018.pdf" },
        2017: { issuedAt: new Date("2017-01-01"), adminName: "Admin", pdfPath: "/uploads/cert-APP-9001-2017.pdf" },
      },
    },
    ...overrides,
  };
}

describe("Applicant certificate PDF download", () => {
  let applicationRoutes;

  beforeAll(async () => {
    const importedModule = await import("../routes/applicationRoutes.js");
    applicationRoutes = importedModule.default;
    app.use("/api/v1/applications", applicationRoutes);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    currentUser = { _id: OWNER_ID, role: "applicant" };
    fs.writeFileSync(path.join(uploadsDir, "cert-APP-9001-2018.pdf"), "%PDF-1.4 test");
    fs.writeFileSync(path.join(uploadsDir, "cert-APP-9001-2017.pdf"), "%PDF-1.4 old");
  });

  afterAll(() => {
    fs.rmSync(uploadsDir, { recursive: true, force: true });
  });

  it("serves the certificate PDF to the owning applicant", async () => {
    mockFindOne.mockResolvedValueOnce(makeApp());

    const res = await request(app).get("/api/v1/applications/APP-9001/certificate/pdf");

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("application/pdf");
    expect(res.headers["content-disposition"]).toContain("cert-APP-9001-2018.pdf");
  });

  it("returns 404 for an application owned by another applicant", async () => {
    currentUser = { _id: OTHER_ID, role: "applicant" };
    mockFindOne.mockResolvedValueOnce(makeApp());

    const res = await request(app).get("/api/v1/applications/APP-9001/certificate/pdf");

    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Application not found");
  });

  it("returns 404 for an anonymous-looking request with no matching applicant", async () => {
    currentUser = { _id: OTHER_ID, role: "applicant" };
    mockFindOne.mockResolvedValueOnce(
      makeApp({
        applicant: {
          _id: OWNER_ID,
          equals: (other) => String(other) === OWNER_ID,
        },
      }),
    );

    const res = await request(app).get("/api/v1/applications/APP-9001/certificate/pdf");

    expect(res.status).toBe(404);
  });

  it("returns 404 when the application does not exist", async () => {
    mockFindOne.mockResolvedValueOnce(null);

    const res = await request(app).get("/api/v1/applications/APP-9999/certificate/pdf");

    expect(res.status).toBe(404);
  });

  it("returns 409 when the certificate has not been issued yet", async () => {
    mockFindOne.mockResolvedValueOnce(
      makeApp({ status: "admin_approved", certificate: null }),
    );

    const res = await request(app).get("/api/v1/applications/APP-9001/certificate/pdf");

    expect(res.status).toBe(409);
    expect(res.body.message).toBe("Certificate has not been issued yet");
  });

  it("returns 404 when the PDF file is missing from the server", async () => {
    fs.rmSync(path.join(uploadsDir, "cert-APP-9001-2018.pdf"), { force: true });
    mockFindOne.mockResolvedValueOnce(makeApp());

    const res = await request(app).get("/api/v1/applications/APP-9001/certificate/pdf");

    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Certificate PDF is not available");
  });

  it("allows staff and admin to download the certificate PDF", async () => {
    currentUser = { _id: "staff-1", role: "staff" };
    mockFindOne.mockResolvedValueOnce(makeApp());

    const res = await request(app).get("/api/v1/applications/APP-9001/certificate/pdf");

    expect(res.status).toBe(200);
  });

  it("serves a historical certificate version when a year is requested", async () => {
    mockFindOne.mockResolvedValueOnce(makeApp());

    const res = await request(app).get(
      "/api/v1/applications/APP-9001/certificate/pdf?year=2017",
    );

    expect(res.status).toBe(200);
    expect(res.headers["content-disposition"]).toContain("cert-APP-9001-2017.pdf");
  });

  it("does not fall back to another year when the requested year has no PDF", async () => {
    mockFindOne.mockResolvedValueOnce(
      makeApp({
        certificate: {
          referenceNumber: "1/2018",
          latestYear: 2018,
          issuedAt: new Date("2018-01-01"),
          adminName: "Admin",
          pdfPath: "/uploads/cert-APP-9001-2018.pdf",
          history: {
            2018: { pdfPath: "/uploads/cert-APP-9001-2018.pdf" },
            2016: { pdfPath: "/uploads/cert-APP-9001-2016.pdf" },
          },
        },
      }),
    );

    const res = await request(app).get(
      "/api/v1/applications/APP-9001/certificate/pdf?year=2016",
    );

    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Certificate PDF is not available");
  });

  it("serves the certificate PDF for an expired certificate", async () => {
    mockFindOne.mockResolvedValueOnce(makeApp({ status: "expired" }));

    const res = await request(app).get("/api/v1/applications/APP-9001/certificate/pdf");

    expect(res.status).toBe(200);
  });
});

describe("Static uploads guard for certificate PDFs", () => {
  const staticApp = express();
  staticApp.use("/uploads", blockCertificatePdfStaticAccess);
  staticApp.get("/uploads/*", (req, res) => res.status(200).send("file"));

  it("blocks direct static access to certificate PDFs", async () => {
    const res = await request(staticApp).get("/uploads/cert-APP-9001-2018.pdf");

    expect(res.status).toBe(404);
  });

  it("still allows other uploaded documents to be served", async () => {
    const res = await request(staticApp).get("/uploads/photo-1234.jpg");

    expect(res.status).toBe(200);
  });
});
