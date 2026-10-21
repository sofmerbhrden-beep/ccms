import { resolveCertificatePdfPath } from "./certificateFiles.js";

export const API_ROOT = "/api/v1";

function link(href, method) {
  return method ? { href, method } : { href };
}

export function userRepresentation(u, { requester } = {}) {
  const self = `${API_ROOT}/users/${u._id}`;
  const rep = {
    id: u._id,
    username: u.username,
    fullName: u.fullName,
    role: u.role,
    active: u.active,
    email: u.email,
    mustChangePassword: u.mustChangePassword,
    createdAt: u.createdAt,
    _links: {
      self: link(self),
    },
  };
  if (requester?.role === "admin") {
    rep._links.password_resets = link(`${self}/password-resets`, "POST");
    rep._links.collection = link(`${API_ROOT}/users`);
  }
  if (requester && String(requester._id) === String(u._id)) {
    rep._links.password = link(`${self}/password`, "PUT");
  }
  return rep;
}

export function sessionRepresentation(u) {
  return {
    user: userRepresentation(u, { requester: u }),
    _links: {
      self: link(`${API_ROOT}/sessions/current`),
      logout: link(`${API_ROOT}/sessions/current`, "DELETE"),
      applications: link(`${API_ROOT}/applications`),
      service_types: link(`${API_ROOT}/service-types`),
    },
  };
}

function documentRepresentation(d) {
  if (!d) return null;
  return {
    name: d.name,
    url: d.path,
    mimeType: d.mimeType,
    size: d.size,
  };
}

function decisionRepresentation(d) {
  if (!d) return null;
  return {
    by: d.byName,
    decision: d.decision,
    reason: d.reason,
    at: d.at,
  };
}

export function certificateSelfHref(refNumber) {

  const [seq, year] = String(refNumber).split("/");
  return `${API_ROOT}/certificates/${year}/${seq}`;
}

export function applicationRepresentation(app, { requester } = {}) {
  const self = `${API_ROOT}/applications/${app.appId}`;


  let certRep = null;
  if (app.certificate) {
    const histObj = app.certificate.history?.toObject
      ? app.certificate.history.toObject()
      : app.certificate.history || {};
    const pdfAvailable = !!resolveCertificatePdfPath(app);
    certRep = {
      referenceNumber: app.certificate.referenceNumber,
      latestYear: app.certificate.latestYear,
      issuedAt: app.certificate.issuedAt,
      adminName: app.certificate.adminName,
      pdfAvailable,
      history: Object.fromEntries(
        Object.entries(histObj).map(([y, v]) => [
          y,
          { issuedAt: v.issuedAt, adminName: v.adminName },
        ]),
      ),
      _links: pdfAvailable
        ? { download: link(`${API_ROOT}/applications/${app.appId}/certificate/pdf`) }
        : {},
    };
  }

  const rep = {
    id: app.appId,
    applicationType: app.applicationType,
    renewalOf: app.renewalOf || null,
    status: app.status,
    applicant: app.applicantInfo,
    hasTradeLicense: app.hasTradeLicense,
    tin: app.tin,
    tinVerified: app.tinVerified,
    businessName: app.businessName,
    serviceType: app.serviceType,
    documents: {
      photo: documentRepresentation(app.documents?.photo),
      education: documentRepresentation(app.documents?.education),
      competency: documentRepresentation(app.documents?.competency),
      tradeLicense: documentRepresentation(app.documents?.tradeLicense),
      others: (app.documents?.others || []).map(documentRepresentation),
    },
    staffDecision: decisionRepresentation(app.staffDecision),
    adminDecision: decisionRepresentation(app.adminDecision),
    certificate: certRep,
    submittedAt: app.submittedAt,
    _links: {
      self: link(self),
      collection: link(`${API_ROOT}/applications`),
      decisions: link(`${self}/decisions`),
    },
  };



  const role = requester?.role;
  if (role === "applicant" && app.status === "staff_review") {
    rep._links.withdraw = link(self, "PATCH");
  }
  if (role === "staff" && app.status === "staff_review") {
    rep._links.decide = link(`${self}/decisions`, "POST");
  }
  if (role === "admin" && app.status === "admin_review") {
    rep._links.decide = link(`${self}/decisions`, "POST");
  }
  if (role === "admin" && app.status === "admin_approved") {
    rep._links.certificate = link(`${self}/certificate`, "POST");
  }
  if (app.certificate?.referenceNumber) {
    rep._links.certificate = link(
      certificateSelfHref(app.certificate.referenceNumber),
    );
  }
  return rep;
}

export function certificateRepresentation(app) {
  const histObj = app.certificate.history?.toObject
    ? app.certificate.history.toObject()
    : app.certificate.history || {};
  return {
    valid: true,
    referenceNumber: app.certificate.referenceNumber,
    latestYear: app.certificate.latestYear,
    issuedAt: app.certificate.issuedAt,
    holderName: app.applicantInfo.fullName,
    businessName: app.businessName,
    adminName: app.certificate.adminName,
    serviceType: { name: app.serviceType?.name, code: app.serviceType?.code },
    history: Object.fromEntries(
      Object.entries(histObj).map(([y, v]) => [y, { issuedAt: v.issuedAt }]),
    ),
    _links: {
      self: link(certificateSelfHref(app.certificate.referenceNumber)),
    },
  };
}

export function serviceTypeRepresentation(s, { requester } = {}) {
  const self = `${API_ROOT}/service-types/${s.stId}`;
  const rep = {
    id: s.stId,
    code: s.code,
    tier: s.tier,
    name: s.name,
    nameAm: s.nameAm,
    active: s.active,
    _links: {
      self: link(self),
      collection: link(`${API_ROOT}/service-types`),
    },
  };
  if (requester?.role === "admin") {
    rep._links.edit = link(self, "PATCH");
    rep._links.delete = link(self, "DELETE");
  }
  return rep;
}

export function collectionRepresentation(
  res,
  { items, page, limit, total, baseHref },
) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const href = (p) => `${baseHref}?page=${p}&limit=${limit}`;

  const _links = {
    self: link(href(page)),
    first: link(href(1)),
    last: link(href(totalPages)),
  };
  if (page > 1) _links.prev = link(href(page - 1));
  if (page < totalPages) _links.next = link(href(page + 1));

  res.set(
    "Link",
    Object.entries(_links)
      .map(([rel, l]) => `<${l.href}>; rel="${rel}"`)
      .join(", "),
  );

  return { items, page, limit, total, totalPages, _links };
}

export function parsePagination(
  req,
  { defaultLimit = 20, maxLimit = 100 } = {},
) {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(
    maxLimit,
    Math.max(1, parseInt(req.query.limit, 10) || defaultLimit),
  );
  return { page, limit, skip: (page - 1) * limit };
}
