import request from "supertest";
import express from "express";
import { jest } from "@jest/globals";

const app = express();
app.use(express.json());

// Mock Auth Middleware
jest.unstable_mockModule("../middleware/authMiddleware.js", () => ({
  protect: (req, res, next) => {
    req.user = { _id: "admin1", username: "admin", role: "admin" };
    next();
  },
  requireRole: (...roles) => (req, res, next) => next(),
  identify: (req, res, next) => next(),
}));

// Mock Mailer
jest.unstable_mockModule("../utils/mailer.js", () => ({
  sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
  sendTempPasswordEmail: jest.fn().mockResolvedValue(true),
  sendStatusEmail: jest.fn().mockResolvedValue(true),
  verifyMailer: jest.fn().mockResolvedValue(true),
  sendCertificateEmailNotification: jest.fn().mockResolvedValue(true),
  send: jest.fn().mockResolvedValue(true),
}));

// Mock Token
jest.unstable_mockModule("../utils/token.js", () => ({
  sendToken: jest.fn((res, user) => res.cookie("token", "mock_token")),
  clearToken: jest.fn((res) => res.clearCookie("token")),
}));

// Mock User Model
const mockUserFindOne = jest.fn();
const mockUserCreate = jest.fn();
const mockUserFindById = jest.fn();
const mockUserFind = jest.fn();

jest.unstable_mockModule("../models/User.js", () => ({
  default: {
    findOne: mockUserFindOne,
    create: mockUserCreate,
    findById: mockUserFindById,
    find: mockUserFind,
    countDocuments: jest.fn().mockResolvedValue(1),
  },
}));

// Mock ServiceType Model
const mockServiceTypeFind = jest.fn();
const mockServiceTypeFindOne = jest.fn();
const mockServiceTypeCreate = jest.fn();

jest.unstable_mockModule("../models/ServiceType.js", () => ({
  default: {
    find: mockServiceTypeFind,
    findOne: mockServiceTypeFindOne,
    create: mockServiceTypeCreate,
  },
}));

// Mock Settings Model
const mockSettingsFindById = jest.fn();
const mockSettingsFindByIdAndUpdate = jest.fn();

jest.unstable_mockModule("../models/Settings.js", () => ({
  default: {
    findById: mockSettingsFindById,
    findByIdAndUpdate: mockSettingsFindByIdAndUpdate,
  },
}));

// Mock Application Model
const mockAggregate = jest.fn();

jest.unstable_mockModule("../models/Application.js", () => ({
  default: {
    aggregate: mockAggregate,
  },
}));

describe("Backend Controllers & Routes Detailed Unit/Integration Test Suite", () => {
  let userRoutes;
  let serviceTypeRoutes;
  let settingsRoutes;
  let reportRoutes;

  beforeAll(async () => {
    process.env.STAFF_ACCESS_CODE = "STAFF_SECRET_123";
    process.env.ADMIN_ACCESS_CODE = "ADMIN_SECRET_123";

    const userMod = await import("../routes/userRoutes.js");
    const stMod = await import("../routes/serviceTypeRoutes.js");
    const setMod = await import("../routes/settingsRoutes.js");
    const repMod = await import("../routes/reportRoutes.js");

    userRoutes = userMod.default;
    serviceTypeRoutes = stMod.default;
    settingsRoutes = setMod.default;
    reportRoutes = repMod.default;

    app.use("/api/v1/users", userRoutes);
    app.use("/api/v1/service-types", serviceTypeRoutes);
    app.use("/api/v1/settings", settingsRoutes);
    app.use("/api/v1/reports", reportRoutes);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Validate Access Codes Controller Logic", () => {
    it("returns 200 with valid staff access code", async () => {
      const res = await request(app)
        .post("/api/v1/users/validate-staff-code")
        .send({ accessCode: "STAFF_SECRET_123" });
      expect(res.status).toBe(200);
      expect(res.body.valid).toBe(true);
    });

    it("returns 403 with invalid staff access code", async () => {
      const res = await request(app)
        .post("/api/v1/users/validate-staff-code")
        .send({ accessCode: "WRONG" });
      expect(res.status).toBe(403);
      expect(res.body.message).toBe("Invalid access code");
    });

    it("returns 200 with valid admin access code", async () => {
      const res = await request(app)
        .post("/api/v1/users/validate-admin-code")
        .send({ accessCode: "ADMIN_SECRET_123" });
      expect(res.status).toBe(200);
      expect(res.body.valid).toBe(true);
    });
  });

  describe("Register User Controller Logic", () => {
    it("returns 409 when user with email already exists", async () => {
      mockUserFindOne.mockResolvedValueOnce({ _id: "user1", email: "existing@example.com" });

      const res = await request(app)
        .post("/api/v1/users/register")
        .send({
          username: "Existing User",
          email: "existing@example.com",
          password: "password123",
          role: "applicant",
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toBe("An account with that email already exists");
    });

    it("registers staff successfully when access code is valid", async () => {
      mockUserFindOne.mockResolvedValueOnce(null);
      mockUserCreate.mockResolvedValueOnce({
        _id: "staff1",
        username: "staff@example.com",
        email: "staff@example.com",
        role: "staff",
      });

      const res = await request(app)
        .post("/api/v1/users/register")
        .send({
          username: "Staff Member",
          fullName: "Staff Member",
          email: "staff@example.com",
          password: "password123",
          role: "staff",
          accessCode: "STAFF_SECRET_123",
        });

      expect(res.status).toBe(201);
      expect(res.body.role).toBe("staff");
    });
  });

  describe("ServiceType Controller Logic", () => {
    it("returns active service types list for request", async () => {
      mockServiceTypeFind.mockReturnValue({
        sort: jest.fn().mockResolvedValue([
          { stId: "st-01", code: "CIVIL", name: "Civil Work", nameAm: "ሲቪል", active: true },
        ]),
      });

      const res = await request(app).get("/api/v1/service-types");
      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].name).toBe("Civil Work");
    });
  });

  describe("Settings Controller Logic", () => {
    it("returns org settings", async () => {
      mockSettingsFindById.mockResolvedValueOnce({
        orgNameEn: "Butajira Office",
        orgNameAm: "ቡታጅራ",
        contactEmail: "info@butajira.gov.et",
      });

      const res = await request(app).get("/api/v1/settings");
      expect(res.status).toBe(200);
      expect(res.body.orgNameEn).toBe("Butajira Office");
    });
  });

  describe("Report Analytics Controller Logic", () => {
    it("aggregates analytics status, service and trend data", async () => {
      mockAggregate
        .mockResolvedValueOnce([{ _id: "staff_review", count: 5 }])
        .mockResolvedValueOnce([{ _id: "General Contracting", count: 5 }])
        .mockResolvedValueOnce([{ _id: { year: 2026, month: 8 }, count: 5 }]);

      const res = await request(app).get("/api/v1/reports/analytics");
      expect(res.status).toBe(200);
      expect(res.body.statusData).toHaveLength(1);
      expect(res.body.serviceData).toHaveLength(1);
    });
  });
});
