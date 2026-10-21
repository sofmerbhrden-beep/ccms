import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { api } from "@/services/api.js";
import CertificateModal from "./CertificateModal.jsx";

const mockDownloadCertificatePdf = jest.fn();

jest.mock("@/services/api.js", () => ({
  api: {
    downloadCertificatePdf: (...args) => mockDownloadCertificatePdf(...args),
  },
}));

jest.mock("./CertificatePreview.jsx", () => ({
  __esModule: true,
  default: ({ selectedYear }) => <div>Preview for {selectedYear}</div>,
}));

const app = {
  id: "APP-7001",
  certificate: {
    referenceNumber: "1/2018",
    latestYear: 2018,
    history: {
      2018: { issuedAt: "2018-01-01" },
      2017: { issuedAt: "2017-01-01" },
    },
  },
};

describe("CertificateModal", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDownloadCertificatePdf.mockResolvedValue({ filename: "cert.pdf", size: 10 });
  });

  it("downloads the PDF for the currently selected year", async () => {
    render(<CertificateModal app={app} onClose={() => {}} pdfAvailable={true} />);

    expect(screen.getByText("Preview for 2018")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Download PDF/i }));
    await waitFor(() => {
      expect(mockDownloadCertificatePdf).toHaveBeenCalledWith("APP-7001", { year: 2018 });
    });
  });

  it("downloads a historical year PDF after switching versions", async () => {
    render(<CertificateModal app={app} onClose={() => {}} pdfAvailable={true} />);

    fireEvent.click(screen.getByRole("button", { name: "2017" }));
    expect(screen.getByText("Preview for 2017")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Download PDF/i }));
    await waitFor(() => {
      expect(mockDownloadCertificatePdf).toHaveBeenCalledWith("APP-7001", { year: 2017 });
    });
  });

  it("shows an error when the download fails", async () => {
    mockDownloadCertificatePdf.mockRejectedValueOnce(new Error("Certificate PDF is not available"));

    render(<CertificateModal app={app} onClose={() => {}} pdfAvailable={true} />);
    fireEvent.click(screen.getByRole("button", { name: /Download PDF/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Certificate PDF is not available");
    });
  });
});
