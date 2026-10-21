import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { BrowserRouter } from "react-router-dom";
import { LanguageProvider } from "@/context/LanguageContext.jsx";
import ApplicantDashboard from "./ApplicantDashboard.jsx";

const mockApplications = [
  {
    id: "APP-5003",
    status: "certificate_generated",
    submittedAt: "2026-08-12T14:00:00Z",
    serviceType: { name: "Plumbing Services", nameAm: "የቧንቧ አገልግሎት" },
    certificate: { referenceNumber: "REF-998877", pdfAvailable: true },
  },
  {
    id: "APP-5005",
    status: "certificate_generated",
    submittedAt: "2026-08-14T14:00:00Z",
    serviceType: { name: "Solar Installation" },
    certificate: { referenceNumber: "REF-112233", pdfAvailable: false },
  },
];

let mockCurrentApplications = mockApplications;
const mockNavigate = jest.fn();
const mockDownloadCertificatePdf = jest.fn();

jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: () => mockNavigate,
}));

jest.mock("@/hooks/useAppData.js", () => ({
  useAppData: () => ({
    applications: mockCurrentApplications,
  }),
}));

jest.mock("@/hooks/useAuth.js", () => ({
  useAuth: () => ({
    user: { fullName: "Abebe Bikila", email: "abebe@example.com" },
  }),
}));

jest.mock("@/services/api.js", () => ({
  api: {
    downloadCertificatePdf: (...args) => mockDownloadCertificatePdf(...args),
  },
}));

jest.mock("@/components/CertificateModal.jsx", () => ({
  __esModule: true,
  default: ({ app, onClose, printOnOpen }) => (
    <div data-testid="certificate-modal" data-print={printOnOpen ? "true" : "false"}>
      <span>Modal for {app.id}</span>
      <button onClick={onClose}>Close modal</button>
    </div>
  ),
}));

function renderWithProviders(ui) {
  return render(
    <LanguageProvider>
      <BrowserRouter>{ui}</BrowserRouter>
    </LanguageProvider>,
  );
}

describe("ApplicantDashboard certificate actions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCurrentApplications = mockApplications;
    mockDownloadCertificatePdf.mockResolvedValue({ filename: "cert.pdf", size: 12 });
  });

  it("shows preview, download and print buttons when a certificate PDF is available", () => {
    renderWithProviders(<ApplicantDashboard />);

    expect(screen.getAllByRole("button", { name: /Preview certificate/i })[0]).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Download PDF/i })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Print certificate/i })[0]).toBeInTheDocument();
  });

  it("hides certificate actions when no PDF is available", () => {
    renderWithProviders(<ApplicantDashboard />);

    // only APP-5003 exposes the actions
    expect(screen.getAllByRole("button", { name: /Download PDF/i })).toHaveLength(1);
  });

  it("downloads the certificate PDF through the authenticated API helper", async () => {
    renderWithProviders(<ApplicantDashboard />);

    fireEvent.click(screen.getByRole("button", { name: /Download PDF/i }));

    await waitFor(() => {
      expect(mockDownloadCertificatePdf).toHaveBeenCalledWith("APP-5003");
    });
  });

  it("shows an error message when the download fails", async () => {
    mockDownloadCertificatePdf.mockRejectedValueOnce(new Error("Certificate PDF is not available"));

    renderWithProviders(<ApplicantDashboard />);
    fireEvent.click(screen.getByRole("button", { name: /Download PDF/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Certificate PDF is not available");
    });
  });

  it("only shows the download error on the application that failed", async () => {
    mockCurrentApplications = [
      { ...mockApplications[0] },
      {
        ...mockApplications[1],
        certificate: { referenceNumber: "REF-112233", pdfAvailable: true },
      },
    ];
    mockDownloadCertificatePdf.mockRejectedValueOnce(new Error("Certificate PDF is not available"));

    renderWithProviders(<ApplicantDashboard />);
    expect(screen.getAllByRole("button", { name: /Download PDF/i })).toHaveLength(2);

    fireEvent.click(screen.getAllByRole("button", { name: /Download PDF/i })[0]);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    // Only the failing application card rendered the error
    expect(screen.getAllByRole("alert")).toHaveLength(1);
  });

  it("opens the certificate preview modal", () => {
    renderWithProviders(<ApplicantDashboard />);

    expect(screen.queryByTestId("certificate-modal")).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: /Preview certificate/i })[0]);

    expect(screen.getByTestId("certificate-modal")).toBeInTheDocument();
    expect(screen.getByTestId("certificate-modal")).toHaveTextContent("APP-5003");
  });

  it("opens the certificate modal in print mode when printing", () => {
    renderWithProviders(<ApplicantDashboard />);

    fireEvent.click(screen.getAllByRole("button", { name: /Print certificate/i })[0]);

    const modal = screen.getByTestId("certificate-modal");
    expect(modal).toHaveAttribute("data-print", "true");
  });

  it("closes the certificate modal", () => {
    renderWithProviders(<ApplicantDashboard />);

    fireEvent.click(screen.getAllByRole("button", { name: /Preview certificate/i })[0]);
    fireEvent.click(screen.getByRole("button", { name: /Close modal/i }));

    expect(screen.queryByTestId("certificate-modal")).not.toBeInTheDocument();
  });
});
