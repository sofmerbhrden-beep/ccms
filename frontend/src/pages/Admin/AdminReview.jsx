import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, CheckCircle2, XCircle, X, Award, Eye, Printer, RefreshCw, Edit } from "lucide-react";
import { toast } from "sonner";
import ApplicationDetail from "../../components/ApplicationDetail.jsx";
import EditApplicationModal from "../../components/EditApplicationModal.jsx";
import { useAppData } from "@/hooks/useAppData.js";
import { useLanguage } from "@/hooks/useLanguage.js";

export default function AdminReview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getById, adminDecide, generateCertificate } = useAppData();
  const { t } = useLanguage();
  const app = getById(id);

  const [reason, setReason] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [showEdit, setShowEdit] = useState(false);

  if (!app) {
    return (
      <div>
        <p className="text-sm text-gray-500 mb-3">
          {t("notFoundApplication", { id })}
        </p>
        <Link
          to="/admin/application"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg px-3 py-2 hover:bg-gray-50 transition-colors shadow-sm"
        >
          <ArrowLeft size={14} /> {t("backToApplications")}
        </Link>
      </div>
    );
  }

  const canDecide = app.status === "admin_review";
  const canGenerate = app.status === "admin_approved";
  const isIssued = app.status === "certificate_generated";

  async function approve() {
    try {
      await adminDecide(app.id, "approved", "");
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function reject() {
    if (!reason.trim()) return;
    try {
      await adminDecide(app.id, "rejected", reason.trim());
      navigate("/admin/application");
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function issueCertificate() {
    try {
      await generateCertificate(app.id);
    } catch (err) {
      toast.error(err.message);
    }
  }

  return (
    <div>
      <Link
        to="/admin/application"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg px-3 py-2 hover:bg-gray-50 transition-colors shadow-sm mb-4"
      >
        <ArrowLeft size={14} /> {t("backToApplications")}
      </Link>
      {app.applicationType === "renewal" && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mt-2 mb-4 flex items-start gap-4">
          <div className="bg-amber-500 text-white p-2 rounded-lg shrink-0">
            <RefreshCw size={20} />
          </div>
          <div>
            <h2 className="font-bold text-sm text-amber-900 mb-0.5">
              Renewal Application
            </h2>
            <p className="text-xs text-amber-800 font-medium">
              This application is renewing certificate <strong className="font-bold">{app.renewalOf}</strong>.
            </p>
          </div>
        </div>
      )}
      <div className="mb-6 mt-1 flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
          {app.applicantInfo?.fullName || app.applicant?.fullName || "Applicant Details"}
        </h1>
        <button
          onClick={() => setShowEdit(true)}
          className="flex items-center gap-1.5 text-xs font-semibold text-[#3C8DBC] bg-white border border-gray-300 hover:border-[#3C8DBC] rounded-lg px-3 py-2 transition-all shadow-sm cursor-pointer"
        >
          <Edit size={14} /> Edit Details
        </button>
      </div>

      <ApplicationDetail app={app}>
        {canDecide && (
          <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mt-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-4">
              {t("finalDecision")}
            </p>
            {!showReject ? (
              <div className="flex gap-3">
                <button
                  onClick={approve}
                  className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider py-3 rounded-lg transition-colors cursor-pointer shadow-sm"
                >
                  <CheckCircle2 size={16} /> {t("approveAction")}
                </button>
                <button
                  onClick={() => setShowReject(true)}
                  className="flex-1 flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs uppercase tracking-wider py-3 rounded-lg transition-colors cursor-pointer shadow-sm"
                >
                  <XCircle size={16} /> {t("rejectAction")}
                </button>
              </div>
            ) : (
              <div>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={t("reasonForRejection")}
                  rows={3}
                  className="w-full bg-gray-50 border border-gray-300 rounded-lg p-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-rose-500 mb-4 transition-all"
                />
                <div className="flex gap-3">
                  <button
                    onClick={reject}
                    disabled={!reason.trim()}
                    className="flex-1 flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-700 active:scale-[0.98] text-white font-bold text-xs uppercase tracking-wider py-3 rounded-lg transition-all duration-150 disabled:opacity-40 cursor-pointer shadow-md hover:shadow-lg"
                  >
                    <XCircle size={16} /> {t("confirmRejection")}
                  </button>
                  <button
                    onClick={() => setShowReject(false)}
                    className="text-xs font-semibold text-gray-700 bg-white border border-gray-300 px-4 py-3 rounded-lg hover:bg-gray-50 hover:shadow-md active:scale-[0.98] transition-all duration-150 cursor-pointer shadow-sm"
                  >
                    <X size={14} /> {t("cancelAction")}
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

        {canGenerate && (
          <section className="bg-white rounded-xl border border-gray-200 shadow-md p-6 mt-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
              {t("certificateLabel")}
            </p>
            <p className="text-xs text-gray-500 mb-4 font-medium">
              {t("approvedGenerateHint")}
            </p>
            <button
              onClick={issueCertificate}
              className="w-full flex items-center justify-center gap-2 bg-[#3C8DBC] hover:bg-[#357ca5] active:scale-[0.98] text-white font-bold text-xs uppercase tracking-wider py-3 rounded-lg transition-all duration-150 cursor-pointer shadow-md hover:shadow-lg"
            >
              <Award size={16} /> {t("generateCertificate")}
            </button>
          </section>
        )}

        {isIssued && (
          <section className="bg-white rounded-xl border border-gray-200 shadow-md p-6 mt-6">
            <div className="flex items-center justify-between gap-2 mb-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                {t("certIssuedHeading")}
              </p>
              <span className="text-xs font-mono font-bold text-[#3C8DBC] bg-[#3C8DBC]/10 px-2.5 py-1 rounded-md border border-[#3C8DBC]/20">
                {app.certificate.referenceNumber}
              </span>
            </div>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => navigate(`/admin/certificate/${app.id}/print`)}
                className="w-full flex items-center justify-center gap-2 bg-[#1B2A4A] hover:bg-[#22355c] active:scale-[0.98] text-white font-bold text-xs uppercase tracking-wider py-3 px-4 rounded-lg transition-all duration-150 cursor-pointer shadow-md hover:shadow-lg"
              >
                <Printer size={16} /> Print Certificate
              </button>
              <div className="flex items-center gap-2.5 bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-emerald-800 shadow-xs">
                <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                <div className="text-xs">
                  <p className="font-bold text-emerald-900">
                    {t("certSentToUser")}
                  </p>
                  <p className="text-emerald-700 text-[11px] mt-0.5 font-medium">
                    {t("certSentToUserHint")}
                  </p>
                </div>
              </div>
            </div>
          </section>
        )}
      </ApplicationDetail>

      {showEdit && (
        <EditApplicationModal app={app} onClose={() => setShowEdit(false)} />
      )}
    </div>
  );
}
