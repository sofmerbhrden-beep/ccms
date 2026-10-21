import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PlusCircle, FileText, CheckCircle, ShieldCheck, CheckCircle2, ArrowRight, Eye, Download, Printer } from "lucide-react";
import AdminStatusPill from "../../components/AdminStatusPill.jsx";
import CertificateModal from "../../components/CertificateModal.jsx";
import { useAppData } from "@/hooks/useAppData.js";
import { useLanguage } from "@/hooks/useLanguage.js";
import { useAuth } from "@/hooks/useAuth.js";
import { formatEthDate } from "@/utils/ethDate.js";
import { api } from "@/services/api.js";

function ApplicationProgressTracker({ status }) {
  const isRejected = status.includes("rejected");
  const steps = [
    { key: "submitted", label: "Submitted" },
    { key: "staff_review", label: "Staff Review" },
    { key: "admin_review", label: "Admin Review" },
    { key: "issued", label: "Certificate Issued" },
  ];

  let currentStepIdx = 0;
  if (status === "staff_review") currentStepIdx = 1;
  else if (status === "admin_review" || status === "admin_approved") currentStepIdx = 2;
  else if (status === "certificate_generated") currentStepIdx = 3;

  return (
    <div className="mt-5 pt-4 border-t border-gray-100">
      <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">
        Live Application Progress
      </p>
      <div className="grid grid-cols-4 gap-2 relative">
        {steps.map((step, idx) => {
          const isDone = idx < currentStepIdx || status === "certificate_generated";
          const isCurrent = idx === currentStepIdx && !isRejected;

          let badgeBg = "bg-gray-100 text-gray-400 border-gray-200";
          if (isRejected && isCurrent) {
            badgeBg = "bg-rose-600 text-white border-rose-600 shadow-md ring-4 ring-rose-100";
          } else if (isDone) {
            badgeBg = "bg-[#3C8DBC] text-white border-[#3C8DBC] shadow-xs";
          } else if (isCurrent) {
            badgeBg = "bg-white text-[#3C8DBC] border-[#3C8DBC] shadow-md ring-4 ring-sky-100 font-bold";
          }

          return (
            <div key={step.key} className="flex flex-col items-center text-center">
              <div
                className={`h-7 w-7 rounded-full border flex items-center justify-center font-sans text-xs font-bold transition-all duration-200 ${badgeBg}`}
              >
                {isDone ? "✓" : idx + 1}
              </div>
              <span
                className={`text-[11px] font-semibold mt-1.5 leading-tight ${isCurrent ? "text-[#3C8DBC] font-bold" : isDone ? "text-gray-900" : "text-gray-400"
                  }`}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ApplicantDashboard() {
  const navigate = useNavigate();
  const { applications } = useAppData();
  const { t, lang } = useLanguage();
  const { user } = useAuth();
  const userName = user?.fullName || user?.name || user?.username || "";

  const mine = applications;

  const [previewApp, setPreviewApp] = useState(null);
  const [printApp, setPrintApp] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);
  const [downloadError, setDownloadError] = useState(null);

  async function handleDownload(app) {
    setDownloadingId(app.id);
    setDownloadError(null);
    try {
      await api.downloadCertificatePdf(app.id);
    } catch (err) {
      setDownloadError({
        appId: app.id,
        message:
          err?.message || (lang === "am" ? "ፍቃዱን ማውረድ አልተቻለም።" : "Could not download the certificate."),
      });
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <div className="max-w-[880px] mx-auto py-6 sm:py-8 px-4 sm:px-6">

      <div className="mb-8 rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-900 via-[#1B2A4A] to-slate-900 p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <img
          src="/logo2.png"
          alt="Government Seal"
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 opacity-[0.35] pointer-events-none select-none object-contain filter drop-shadow-2xl"
        />

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-start gap-5">
            <div className="hidden sm:flex shrink-0 w-16 h-16 bg-white/10 backdrop-blur-md rounded-2xl items-center justify-center p-2.5 border border-white/20 shadow-md">
              <img
                src="/logo2.png"
                alt="Official Seal"
                className="w-full h-full object-contain filter drop-shadow-md"
              />
            </div>

            <div className="text-center sm:text-left">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white leading-tight tracking-tight">
                {lang === "am"
                  ? `እንኳን ደህና መጡ ${userName}`.trim()
                  : `Welcome ${userName}`.trim()}
              </h1>

              <p className="text-xs sm:text-sm font-medium text-slate-300 mt-1.5 max-w-xl leading-relaxed">
                {lang === "am"
                  ? "የብቃት ማረጋገጫ ማመልከቻዎችን ያስገቡ የማረጋገጫ ሂደቱን ይከታተሉ እና የተሰጡ ምስክር ወረቀቶችን ይመልከቱ"
                  : "Submit competency certification applications track verification progress and manage your official certificates"}
              </p>
            </div>
          </div>

          <button
            onClick={() => navigate("/applicant/apply")}
            className="inline-flex items-center gap-2 bg-[#3C8DBC] hover:bg-[#357ca5] active:scale-[0.98] text-white text-xs font-bold uppercase tracking-wider px-5 py-3.5 rounded-xl shadow-lg border border-sky-400/30 transition-all duration-150 shrink-0 cursor-pointer"
          >
            <PlusCircle size={16} />
            {t("startApplication")}
          </button>
        </div>
      </div>

      <div className="mb-6 pb-2 border-b border-slate-300 flex items-center justify-between">
        <h2 className="text-lg font-bold font-mono text-slate-900 flex items-center gap-2">
          {t("yourApplications")}
        </h2>
        <span className="text-xs font-mono font-bold text-slate-700 uppercase tracking-wider bg-slate-100 px-3 py-1 rounded-lg border border-slate-300 shadow-xs">
          {mine.length} {mine.length === 1 ? "Record" : "Records"}
        </span>
      </div>

      {mine.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center bg-white rounded-2xl border border-gray-200 p-8 shadow-md">
          <div className="mb-4 bg-sky-50 p-4 rounded-2xl border border-sky-200/80 shadow-xs">
            <FileText size={36} className="text-[#3C8DBC]" />
          </div>
          <p className="text-lg font-bold text-gray-900 mb-1.5">
            {t("noApplicationsYet")}
          </p>
          <p className="text-xs font-medium text-gray-500 mb-6 max-w-sm">
            Submit your first application to get started. You will be able to track its progress in real-time here.
          </p>
          <button
            onClick={() => navigate("/applicant/apply")}
            className="inline-flex items-center gap-2 bg-[#3C8DBC] hover:bg-[#357ca5] active:scale-[0.98] text-white text-xs font-bold uppercase tracking-wider px-6 py-3 rounded-lg shadow-md hover:shadow-lg transition-all duration-150 cursor-pointer"
          >
            <PlusCircle size={16} />
            {t("startApplication")}
          </button>
        </div>
      ) : (
        <div className="grid gap-6">
          {mine.map((a) => {
            const isCertGenerated = a.status === "certificate_generated";

            return (
              <div
                key={a.id}
                className="bg-white rounded-xl border border-gray-200/90 p-6 shadow-xl hover:shadow-2xl transition-all duration-200 relative overflow-hidden group"
              >
                <div className="relative z-10">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100">
                    <div>
                      <div className="flex items-center gap-3 text-xs text-gray-500 mb-1">
                        <span className="font-mono font-extrabold text-black bg-white px-2.5 py-0.5 rounded-md border border-gray-300 shadow-xs">{a.id}</span>
                        <span>&bull;</span>
                        <span className="font-medium text-gray-600">{t("submitted")} {formatEthDate(a.submittedAt)}</span>
                      </div>
                      <h3 className="text-lg font-extrabold text-black leading-tight">
                        {typeof a.serviceType === "string"
                          ? a.serviceType
                          : (lang === "am" ? a.serviceType?.nameAm : a.serviceType?.name) || "Competency Certificate"}
                      </h3>
                    </div>

                    <div className="shrink-0">
                      <AdminStatusPill status={a.status} />
                    </div>
                  </div>

                  <ApplicationProgressTracker status={a.status} />

                  <div className="mt-4 flex flex-col gap-3">
                    {a.staffDecision?.decision === "rejected" && (
                      <div className="bg-rose-50 border border-rose-200 rounded-lg p-4 shadow-sm">
                        <p className="text-xs font-bold text-rose-900 mb-1">
                          {t("staffFeedback")}
                        </p>
                        <p className="text-xs font-medium text-rose-800">{a.staffDecision.reason}</p>
                      </div>
                    )}
                    {a.adminDecision?.decision === "rejected" && (
                      <div className="bg-rose-50 border border-rose-200 rounded-lg p-4 shadow-sm">
                        <p className="text-xs font-bold text-rose-900 mb-1">
                          {t("adminFeedback")}
                        </p>
                        <p className="text-xs font-medium text-rose-800">{a.adminDecision.reason}</p>
                      </div>
                    )}

                    {(isCertGenerated || a.certificate) && (
                      <div className="mt-4 bg-white border border-gray-200/90 rounded-lg p-4 flex items-center justify-between gap-3 shadow-lg">
                        <div className="flex items-center gap-3.5">
                          <div className="bg-slate-900 text-white p-2.5 rounded-md shadow-xs shrink-0">
                            <CheckCircle2 size={22} className="text-emerald-400" />
                          </div>
                          <div>
                            <p className="text-xs font-extrabold uppercase tracking-wider text-black">
                              {lang === "am" ? "የምስክር ወረቀት ጸድቋል" : "Official Certificate Issued"} ✓
                            </p>
                            <p className="font-mono text-xs font-bold text-black mt-0.5">
                              Ref: {a.certificate?.referenceNumber || "Issued"}
                            </p>
                            <p className="text-xs text-gray-700 mt-0.5 font-medium">
                              {lang === "am"
                                ? "የእርስዎ ይፋዊ የምስክር ወረቀት ተዘጋጅቷል። ከታች ማየት እና ማውረድ ይችላሉ።"
                                : "Your official certificate has been generated. You can view and download it below."}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {a.certificate?.pdfAvailable && (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => setPreviewApp(a)}
                          className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-white bg-[#1B2A4A] hover:bg-[#22355c] active:scale-[0.98] px-4 py-2.5 rounded-lg shadow-md transition-all duration-150 cursor-pointer"
                        >
                          <Eye size={14} /> {t("certificatePreview")}
                        </button>
                        <button
                          onClick={() => handleDownload(a)}
                          disabled={downloadingId === a.id}
                          className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-white bg-[#3C8DBC] hover:bg-[#357ca5] active:scale-[0.98] disabled:opacity-60 px-4 py-2.5 rounded-lg shadow-md transition-all duration-150 cursor-pointer"
                        >
                          <Download size={14} />
                          {downloadingId === a.id ? t("certificateDownloading") : t("certificateDownload")}
                        </button>
                        <button
                          onClick={() => setPrintApp(a)}
                          className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gray-800 bg-white border border-gray-300 hover:bg-gray-50 active:scale-[0.98] px-4 py-2.5 rounded-lg shadow-sm transition-all duration-150 cursor-pointer"
                        >
                          <Printer size={14} /> {t("certificatePrint")}
                        </button>
                      </div>
                    )}

                    {downloadError?.appId === a.id && (
                      <p className="mt-2 text-xs font-semibold text-rose-700" role="alert">
                        {downloadError.message}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {previewApp && (
        <CertificateModal app={previewApp} onClose={() => setPreviewApp(null)} />
      )}
      {printApp && (
        <CertificateModal app={printApp} onClose={() => setPrintApp(null)} printOnOpen />
      )}

    </div>
  );
}
