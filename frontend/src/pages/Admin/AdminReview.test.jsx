import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { LanguageProvider } from "@/context/LanguageContext.jsx";
import AdminReview from "./AdminReview.jsx";

const mockAdminDecide = jest.fn();
const mockGenerateCertificate = jest.fn();
const mockGetById = jest.fn();
const mockNavigate = jest.fn();

jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: () => mockNavigate,
}));

jest.mock("@/hooks/useAppData.js", () => ({
  useAppData: () => ({
    getById: mockGetById,
    adminDecide: mockAdminDecide,
    generateCertificate: mockGenerateCertificate,
  }),
}));

jest.mock("@/services/api.js", () => ({
  api: {
    sendCertificate: jest.fn().mockResolvedValue({ success: true }),
  },
}));

function renderWithRoute(appId) {
  return render(
    <LanguageProvider>
      <MemoryRouter initialEntries={[`/admin/application/${appId}`]}>
        <Routes>
          <Route path="/admin/application/:id" element={<AdminReview />} />
        </Routes>
      </MemoryRouter>
    </LanguageProvider>
  );
}

describe("AdminReview Component Unit Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders non-existent application fallback message when getById returns null", () => {
    mockGetById.mockReturnValue(null);

    renderWithRoute("INVALID-ID");

    expect(screen.getByText(/No application found with id/i)).toBeInTheDocument();
    expect(screen.getByText(/Back/i)).toBeInTheDocument();
  });

  it("handles Admin Approval workflow when status is admin_review", async () => {
    mockGetById.mockReturnValue({
      id: "APP-555",
      status: "admin_review",
      applicationType: "new",
      submittedAt: "2026-08-10T10:00:00Z",
      applicant: { fullName: "Haile Gebrselassie" },
      serviceType: { name: "Highway Engineering" },
      applicantInfo: { fullName: "Haile Gebrselassie", gender: "male", phone: "0911000000", address: { region: "Addis Ababa", woreda: "01", kebele: "02" } },
      documents: {},
    });

    renderWithRoute("APP-555");

    expect(screen.getAllByText("Haile Gebrselassie")[0]).toBeInTheDocument();
    expect(screen.getByText(/Final Decision/i)).toBeInTheDocument();

    const approveBtn = screen.getByRole("button", { name: /Approve/i });
    fireEvent.click(approveBtn);

    expect(mockAdminDecide).toHaveBeenCalledWith("APP-555", "approved", "");
  });

  it("handles Admin Rejection workflow requiring reason input", async () => {
    mockGetById.mockReturnValue({
      id: "APP-555",
      status: "admin_review",
      applicationType: "new",
      submittedAt: "2026-08-10T10:00:00Z",
      applicant: { fullName: "Haile Gebrselassie" },
      serviceType: { name: "Highway Engineering" },
      applicantInfo: { fullName: "Haile Gebrselassie", gender: "male", phone: "0911000000", address: { region: "Addis Ababa", woreda: "01", kebele: "02" } },
      documents: {},
    });

    renderWithRoute("APP-555");

    const rejectBtn = screen.getByRole("button", { name: /Reject/i });
    fireEvent.click(rejectBtn);

    const textarea = screen.getByPlaceholderText(/Reason for rejection/i);
    expect(textarea).toBeInTheDocument();

    const confirmBtn = screen.getByRole("button", { name: /Confirm Rejection/i });
    expect(confirmBtn).toBeDisabled();

    fireEvent.change(textarea, { target: { value: "Incomplete documentation submitted" } });
    expect(confirmBtn).not.toBeDisabled();

    fireEvent.click(confirmBtn);
    expect(mockAdminDecide).toHaveBeenCalledWith("APP-555", "rejected", "Incomplete documentation submitted");
  });

  it("triggers certificate generation when status is admin_approved", () => {
    mockGetById.mockReturnValue({
      id: "APP-777",
      status: "admin_approved",
      applicationType: "new",
      submittedAt: "2026-08-10T10:00:00Z",
      applicant: { fullName: "Derartu Tulu" },
      serviceType: { name: "Structural Engineering" },
      applicantInfo: { fullName: "Derartu Tulu", gender: "female", phone: "0911000001", address: { region: "Oromia", woreda: "03", kebele: "04" } },
      documents: {},
    });

    renderWithRoute("APP-777");

    const generateBtn = screen.getByRole("button", { name: /Generate Certificate/i });
    fireEvent.click(generateBtn);

    expect(mockGenerateCertificate).toHaveBeenCalledWith("APP-777");
  });

  it("renders print option and certificate sent notification when certificate is generated", async () => {
    mockGetById.mockReturnValue({
      id: "APP-888",
      status: "certificate_generated",
      applicationType: "new",
      submittedAt: "2026-08-10T10:00:00Z",
      applicant: { fullName: "Kenenisa Bekele" },
      serviceType: { name: "Surveying" },
      applicantInfo: { fullName: "Kenenisa Bekele", gender: "male", phone: "0911000002", address: { region: "Addis Ababa", woreda: "05", kebele: "06" } },
      certificate: { referenceNumber: "REF-88899" },
      documents: {},
    });

    renderWithRoute("APP-888");

    expect(screen.getByText("REF-88899")).toBeInTheDocument();

    const printBtn = screen.getByRole("button", { name: /Print Certificate/i });
    fireEvent.click(printBtn);
    expect(mockNavigate).toHaveBeenCalledWith("/admin/certificate/APP-888/print");

    expect(screen.getByText(/Certificate directed to user/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Send to Applicant/i })).not.toBeInTheDocument();
  });
});
