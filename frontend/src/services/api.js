export const API_ROOT = "/api/v1";

export class ApiError extends Error {
  constructor(status, message, body) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

const RETRYABLE = new Set([408, 429, 500, 502, 503, 504]);

async function request(
  path,
  { method = "GET", body, headers = {}, retry = 1 } = {},
) {
  const opts = {
    method,
    credentials: "include",
    headers: { Accept: "application/json", ...headers },
  };

  if (body instanceof FormData) {
    opts.body = body;
  } else if (body !== undefined) {
    opts.headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(`${API_ROOT}${path}`, opts);
  } catch {
    throw new ApiError(
      0,
      "Couldn't reach the server. Check your connection and try again.",
    );
  }

  if (RETRYABLE.has(res.status) && retry > 0 && method === "GET") {
    await new Promise((r) => setTimeout(r, 600));
    return request(path, { method, body, headers, retry: retry - 1 });
  }

  if (res.status === 204) return null;

  let data = null;
  try {
    data = await res.json();
  } catch {

  }

  if (!res.ok) {
    throw new ApiError(
      res.status,
      data?.message || `Request failed (${res.status})`,
      data,
    );
  }
  return data;
}

export function follow(link, { body } = {}) {
  if (!link?.href) throw new ApiError(0, "No link to follow");
  const path = link.href.startsWith(API_ROOT)
    ? link.href.slice(API_ROOT.length)
    : link.href;
  return request(path, { method: link.method || "GET", body });
}

export async function downloadCertificatePdf(id, { year } = {}) {
  const path = `/applications/${encodeURIComponent(id)}/certificate/pdf${
    year ? `?year=${encodeURIComponent(year)}` : ""
  }`;
  const res = await fetch(`${API_ROOT}${path}`, {
    method: "GET",
    credentials: "include",
    headers: { Accept: "application/pdf" },
  });

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      message = data?.message || message;
    } catch {
      // non-JSON error body
    }
    throw new ApiError(res.status, message);
  }

  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition") || "";
  const match = /filename="?([^"]+)"?/.exec(disposition);
  const filename = match?.[1] || `certificate-${id}${year ? `-${year}` : ""}.pdf`;

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return { filename, size: blob.size };
}

export const api = {

  login: (email, password) =>
    request("/sessions", { method: "POST", body: { email, password } }),
  loginApplicant: (email, password) =>
    request("/sessions/applicant", {
      method: "POST",
      body: { email, password },
    }),
  loginStaff: (email, password) =>
    request("/sessions/v8k2mxp4", {
      method: "POST",
      body: { email, password },
    }),
  loginAdmin: (email, password) =>
    request("/sessions/zq9wr3nt", {
      method: "POST",
      body: { email, password },
    }),
  loginDemo: (role) => request(`/sessions/demo/${role}`, { method: "POST" }),
  logout: () => request("/sessions/current", { method: "DELETE" }),
  currentSession: () => request("/sessions/current"),


  register: (username, fullName, password) =>
    request("/users", {
      method: "POST",
      body: { username, fullName, password },
    }),
  registerWithRole: (username, fullName, password, role, accessCode, email) =>
    request("/users/register", {
      method: "POST",
      body: { username, fullName, password, role, accessCode, email },
    }),
  forgotPassword: (email) =>
    request("/users/forgot-password", { method: "POST", body: { email } }),
  staffForgotPassword: (accessCode, email) =>
    request("/users/staff-forgot-password", {
      method: "POST",
      body: { accessCode, email },
    }),
  adminForgotPassword: (accessCode, email) =>
    request("/users/admin-forgot-password", {
      method: "POST",
      body: { accessCode, email },
    }),
  resetPassword: (token, password) =>
    request("/users/reset-password", {
      method: "POST",
      body: { token, password },
    }),
  validateStaffAccessCode: (accessCode) =>
    request("/users/validate-staff-code", {
      method: "POST",
      body: { accessCode },
    }),
  validateAdminAccessCode: (accessCode) =>
    request("/users/validate-admin-code", {
      method: "POST",
      body: { accessCode },
    }),
  users: (page = 1, limit = 50) =>
    request(`/users?page=${page}&limit=${limit}`),
  createUser: (username, fullName, role) =>
    request("/users", { method: "POST", body: { username, fullName, role } }),
  updateUser: (id, patch) =>
    request(`/users/${id}`, { method: "PATCH", body: patch }),
  deleteUser: (id) => request(`/users/${id}`, { method: "DELETE" }),
  adminResetPassword: (id) =>
    request(`/users/${id}/password-resets`, { method: "POST" }),
  changePassword: (id, currentPassword, newPassword) =>
    request(`/users/${id}/password`, {
      method: "PUT",
      body: { currentPassword, newPassword },
    }),


  applications: (page = 1, limit = 100) =>
    request(`/applications?page=${page}&limit=${limit}`),
  application: (id) => request(`/applications/${encodeURIComponent(id)}`),
  submitApplication: (formData) =>
    request("/applications", { method: "POST", body: formData }),
  renewalLookup: (ref) =>
    request(`/applications/renewal-lookup?ref=${encodeURIComponent(ref)}`),
  withdrawApplication: (id) =>
    request(`/applications/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: { status: "withdrawn" },
    }),
  updateApplication: (id, patch) =>
    request(`/applications/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: patch,
    }),
  decide: (id, decision, reason) =>
    request(`/applications/${encodeURIComponent(id)}/decisions`, {
      method: "POST",
      body: { decision, reason },
    }),
  generateCertificate: (id) =>
    request(`/applications/${encodeURIComponent(id)}/certificate`, {
      method: "POST",
    }),
  sendCertificate: (id) =>
    request(`/applications/${encodeURIComponent(id)}/certificate/send`, {
      method: "POST",
    }),
  downloadCertificatePdf: (id, opts) => downloadCertificatePdf(id, opts),


  verifyCertificate: (refNumber) => {
    const [seq, year] = String(refNumber).split("/");
    return request(`/certificates/${year}/${seq}`);
  },


  serviceTypes: () => request("/service-types"),
  verifyTin: (tin, businessName, businessNameAm) =>
    request("/applications/verify-tin", { method: "POST", body: { tin, businessName, businessNameAm } }),
  createServiceType: (data) =>
    request("/service-types", { method: "POST", body: data }),
  updateServiceType: (stId, patch) =>
    request(`/service-types/${stId}`, { method: "PATCH", body: patch }),
  deleteServiceType: (stId) =>
    request(`/service-types/${stId}`, { method: "DELETE" }),


  businessRegistration: (tin) => request(`/business-registrations/${tin}`),


  getSettings: () => request("/settings"),
  saveSettings: (data) => request("/settings", { method: "PUT", body: data }),
  getAnalytics: () => request("/reports/analytics"),
};
