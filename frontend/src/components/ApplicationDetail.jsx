import { useState } from "react";
import { FileText, Image, ExternalLink } from "lucide-react";
import StatusBadge from "./StatusBadge.jsx";
import AdminStatusPill from "./AdminStatusPill.jsx";
import { formatEthDateTime } from "@/utils/ethDate.js";

function DocViewer({ label, doc }) {
  const [open, setOpen] = useState(false);
  if (!doc?.url) {
    return (
      <div className="flex items-center gap-3 py-3 border-b border-gray-100 last:border-b-0">
        <div className="h-9 w-9 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
          <FileText size={16} className="text-gray-400" />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{label}</p>
          <p className="text-xs text-gray-400 mt-0.5">Not uploaded</p>
        </div>
      </div>
    );
  }

  const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(doc.name || "") || /\.(jpg|jpeg|png|gif|webp)$/i.test(doc.url || "");
  const isPdf = /\.pdf$/i.test(doc.name || "") || /\.pdf$/i.test(doc.url || "");

  const baseUrl = import.meta.env.VITE_API_URL
    ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, "")
    : "";
  const fileUrl = doc.url?.startsWith("/uploads/")
    ? `${baseUrl}${doc.url}`
    : doc.url;

  return (
    <div className="border-b border-gray-100 last:border-b-0">
      <div className="flex items-center justify-between gap-3 py-3">
        <div className="flex items-center gap-3 min-w-0">
          {isImage
            ? <Image size={16} className="text-[#3C8DBC] shrink-0" />
            : <FileText size={16} className="text-[#3C8DBC] shrink-0" />}
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{label}</p>
            <p className="text-sm font-semibold text-gray-900 truncate mt-0.5">{doc.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => setOpen((v) => !v)}
            className="text-xs font-semibold text-gray-700 border border-gray-300 bg-white rounded-lg px-3 py-1.5 hover:bg-gray-50 hover:shadow-md active:scale-[0.98] transition-all duration-150 shadow-sm cursor-pointer">
            {open ? "Hide" : "Preview"}
          </button>
          <a href={fileUrl} target="_blank" rel="noopener noreferrer"
            className="text-xs font-semibold text-white bg-[#3C8DBC] hover:bg-[#357ca5] hover:shadow-md active:scale-[0.98] rounded-lg px-3 py-1.5 transition-all duration-150 shadow-sm flex items-center gap-1.5 cursor-pointer">
            <ExternalLink size={12} /> Open
          </a>
        </div>
      </div>
      {open && (
        <div className="pb-4">
          {isImage ? (
            <div className="flex justify-center bg-gray-50/50 p-2 rounded-xl border border-gray-200 shadow-inner">
              <img
                src={fileUrl}
                alt={doc.name}
                style={{ imageRendering: "high-quality" }}
                className="max-h-[650px] max-w-full w-auto mx-auto object-contain rounded-lg border border-gray-200 shadow-md"
              />
            </div>
          ) : isPdf ? (
            <iframe src={fileUrl} title={doc.name} className="w-full h-[600px] rounded-xl border border-gray-200 shadow-md" />
          ) : (
            <div className="flex flex-col items-center py-8 text-gray-500 bg-gray-50 rounded-xl border border-gray-200 shadow-sm">
              <FileText size={32} className="mb-2 text-gray-400" />
              <p className="text-sm font-medium">Preview not available.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ApplicationDetail({
  app,
  children,
}) {
  const theme = {
    section: "bg-white rounded-xl border border-gray-200 p-6 shadow-md hover:shadow-lg transition-shadow duration-200",
    heading: "text-base font-bold text-gray-900 mb-4 pb-2 border-b border-gray-100",
    row: "flex justify-between items-center gap-4 py-2.5 border-b border-gray-100 last:border-b-0",
    label: "text-xs font-semibold uppercase tracking-wider text-gray-500",
    value: "text-sm font-medium text-gray-900 text-right",
    mono: "font-mono text-xs font-bold text-gray-900",
    accentMono: "font-mono text-xs font-bold text-[#3C8DBC] bg-sky-50 px-2.5 py-0.5 rounded-md border border-sky-200 shadow-xs",
    muted: "text-sm text-gray-400 font-medium",
    bodyText: "text-sm text-gray-900 font-semibold",
    subText: "text-xs text-gray-600 font-medium",
    faintText: "text-xs text-gray-400 font-medium",
    timestampText: "text-xs text-gray-500 font-medium",
    StatusComponent: AdminStatusPill,
  };

  const {
    section,
    heading,
    row,
    label,
    value,
    mono,
    accentMono,
    muted,
    bodyText,
    subText,
    faintText,
    timestampText,
    StatusComponent,
  } = theme;

  const docs = [
    { key: "photo", label: "Applicant photo" },
    { key: "education", label: "Education certificate" },
    { key: "tradeLicense", label: "Trade license", optional: true },
  ];

  const applicantObj = app.applicantInfo || (typeof app.applicant === "object" ? app.applicant : {}) || {};
  const applicantAddr = applicantObj.address || (typeof app.applicant === "object" ? app.applicant?.address : {}) || {};

  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-6">
      <div className="space-y-6">
        <section className={section}>
          <h2 className={heading}>Applicant information</h2>
          <div>
            <div className={row}>
              <span className={label}>Full name</span>
              <span className={value}>{applicantObj.fullName || "-"}</span>
            </div>
            <div className={row}>
              <span className={label}>Gender</span>
              <span className={value}>{applicantObj.gender || "-"}</span>
            </div>
            <div className={row}>
              <span className={label}>Date of birth</span>
              <span className={value}>{applicantObj.dob || "-"}</span>
            </div>
            <div className={row}>
              <span className={label}>Phone</span>
              <span className={value}>{applicantObj.phone || "-"}</span>
            </div>
            <div className={row}>
              <span className={label}>Region</span>
              <span className={value}>{applicantAddr.region || "-"}</span>
            </div>
            <div className={row}>
              <span className={label}>Woreda</span>
              <span className={value}>{applicantAddr.woreda || "-"}</span>
            </div>
            <div className={row}>
              <span className={label}>Kebele</span>
              <span className={value}>{applicantAddr.kebele || "-"}</span>
            </div>
            <div className={row}>
              <span className={label}>House No.</span>
              <span className={value}>
                {applicantAddr.houseNo || "-"}
              </span>
            </div>
            <div className={row}>
              <span className={label}>P.O. Box</span>
              <span className={value}>
                {applicantAddr.poBox || "-"}
              </span>
            </div>
            <div className={row}>
              <span className={label}>Fax</span>
              <span className={value}>{applicantAddr.fax || "-"}</span>
            </div>
            <div className={row}>
              <span className={label}>Email</span>
              <span className={value}>
                {applicantAddr.email || "-"}
              </span>
            </div>
            <div className={row}>
              <span className={label}>Cert. Address</span>
              <span className={value}>
                {applicantAddr.licenseOwnerAddress || "-"}
              </span>
            </div>
          </div>
        </section>

        <section className={section}>
          <h2 className={heading}>Business information</h2>
          {app.hasTradeLicense ? (
            <div>
              <div className={row}>
                <span className={label}>TIN number</span>
                <span className={mono}>{app.tin}</span>
              </div>
              <div className={row}>
                <span className={label}>Business name</span>
                <span className={value}>{app.businessName || "-"}</span>
              </div>
            </div>
          ) : (
            <p className={muted}>No trade license on file.</p>
          )}
        </section>

        <section className={section}>
          <h2 className={heading}>Service type</h2>
          <div className={row}>
            <span className={label}>Service</span>
            <span className={value}>{app.serviceType?.name}</span>
          </div>
          <div className={row}>
            <span className={label}>Service code</span>
            <span className={accentMono}>{app.serviceType?.code}</span>
          </div>
        </section>

        <section className={section}>
          <h2 className={heading}>Documents</h2>
          <div>
            {docs.map((d) => (
              (!d.optional || app.hasTradeLicense) && (
                <DocViewer
                  key={d.key}
                  label={d.label}
                  doc={app.documents?.[d.key]}
                />
              )
            ))}
            {app.documents?.others?.map((f, i) => (
              <DocViewer
                key={`other-${i}`}
                label={`Other document ${i + 1}`}
                doc={f}
              />
            ))}
          </div>
        </section>
      </div>

      <aside className="space-y-6">
        <section className={section}>
          <p className={label + " mb-2"}>Current status</p>
          <StatusComponent status={app.status} />
          <p className={`font-mono text-xs mt-3 ${timestampText}`}>
            Submitted {formatEthDateTime(app.submittedAt)}
          </p>
        </section>

        {app.staffDecision && (
          <section className={section}>
            <p className={label + " mb-2"}>Staff decision</p>
            <p className={`text-xs capitalize ${bodyText}`}>
              {app.staffDecision.decision}
            </p>
            {app.staffDecision.reason && (
              <p className={`text-xs mt-1.5 ${subText}`}>
                {app.staffDecision.reason}
              </p>
            )}
            <p className={`font-mono text-[11px] mt-2 ${faintText}`}>
              {app.staffDecision.by} &middot;{" "}
              {formatEthDateTime(app.staffDecision.at)}
            </p>
          </section>
        )}

        {app.adminDecision && (
          <section className={section}>
            <p className={label + " mb-2"}>Admin decision</p>
            <p className={`text-xs capitalize ${bodyText}`}>
              {app.adminDecision.decision}
            </p>
            {app.adminDecision.reason && (
              <p className={`text-xs mt-1.5 ${subText}`}>
                {app.adminDecision.reason}
              </p>
            )}
            <p className={`font-mono text-[11px] mt-2 ${faintText}`}>
              {app.adminDecision.by} &middot;{" "}
              {formatEthDateTime(app.adminDecision.at)}
            </p>
          </section>
        )}

        {children}
      </aside>
    </div>
  );
}
