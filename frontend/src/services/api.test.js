import { downloadCertificatePdf, api, ApiError } from "./api.js";

describe("downloadCertificatePdf", () => {
  const originalCreateObjectURL = global.URL.createObjectURL;
  const originalRevokeObjectURL = global.URL.revokeObjectURL;

  beforeEach(() => {
    global.URL.createObjectURL = jest.fn(() => "blob:certificate");
    global.URL.revokeObjectURL = jest.fn();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.URL.createObjectURL = originalCreateObjectURL;
    global.URL.revokeObjectURL = originalRevokeObjectURL;
    jest.restoreAllMocks();
  });

  function mockPdfResponse({ ok = true, status = 200, body = null } = {}) {
    const blob = { size: 42 };
    return {
      ok,
      status,
      headers: {
        get: () => 'attachment; filename="cert-APP-5003.pdf"',
      },
      blob: jest.fn().mockResolvedValue(blob),
      json: jest.fn().mockResolvedValue(body),
    };
  }

  it("requests the certificate PDF with credentials and triggers a download", async () => {
    global.fetch.mockResolvedValueOnce(mockPdfResponse());

    const result = await downloadCertificatePdf("APP-5003");

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/v1/applications/APP-5003/certificate/pdf",
      expect.objectContaining({ method: "GET", credentials: "include" }),
    );
    expect(result).toEqual({ filename: "cert-APP-5003.pdf", size: 42 });
    expect(global.URL.createObjectURL).toHaveBeenCalled();
    expect(global.URL.revokeObjectURL).toHaveBeenCalledWith("blob:certificate");
  });

  it("appends the year query parameter when a year is given", async () => {
    global.fetch.mockResolvedValueOnce(mockPdfResponse());

    await downloadCertificatePdf("APP-5003", { year: 2017 });

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/v1/applications/APP-5003/certificate/pdf?year=2017",
      expect.anything(),
    );
  });

  it("throws an ApiError with the server message when the request fails", async () => {
    global.fetch.mockResolvedValueOnce(
      mockPdfResponse({
        ok: false,
        status: 404,
        body: { message: "Certificate PDF is not available" },
      }),
    );

    await expect(downloadCertificatePdf("APP-5003")).rejects.toThrow(
      "Certificate PDF is not available",
    );
    expect(global.URL.createObjectURL).not.toHaveBeenCalled();
  });

  it("exposes the download helper through the api facade", () => {
    expect(typeof api.downloadCertificatePdf).toBe("function");
    expect(new ApiError(404, "nope").status).toBe(404);
  });
});
