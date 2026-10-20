import { useState, useRef, useEffect } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useNavigate } from "react-router-dom";
import { Toaster, toast } from "sonner";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Send,
  Search,
  CheckCircle2,
  UserPlus,
  RefreshCw,
  Paperclip,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import { Button } from "../../components/ui/button.jsx";
import { Input } from "../../components/ui/input.jsx";
import { Label } from "../../components/ui/label.jsx";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "../../components/ui/select.jsx";
import FileDrop from "../../components/FileDrop.jsx";
import Stepper from "../../components/Stepper.jsx";
import { api } from "../../services/api.js";
import EthiopianDobPicker from "../../components/EthiopianDobPicker.jsx";
import { useAppData } from "@/hooks/useAppData.js";
import { useLanguage } from "@/hooks/useLanguage.js";
import ApplicantNavbar from "../../components/applicant/ApplicantNavbar.jsx";
import ApplicantSidebar from "../../components/applicant/ApplicantSidebar.jsx";
import ApplicantFooter from "../../components/applicant/ApplicantFooter.jsx";

const MOBILE_BREAKPOINT = 768;
function isMobileViewport() {
  return typeof window !== "undefined" && window.innerWidth < MOBILE_BREAKPOINT;
}

const LABEL = "text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1.5 block";
const INPUT =
  "h-10 px-4 bg-white border border-gray-300 text-gray-900 placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3C8DBC] rounded-lg transition-all shadow-xs";
const SECTION = "bg-white border border-gray-200 shadow-md rounded-xl p-6 sm:p-10 relative overflow-hidden";
const HEADING = "text-xl font-bold text-gray-900 tracking-tight";
const SELECT_TRIGGER =
  "h-10 px-4 w-full bg-white border border-gray-300 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#3C8DBC] rounded-lg transition-all shadow-xs data-[placeholder]:text-gray-400";
const SELECT_CONTENT = "bg-white border border-gray-200 shadow-lg rounded-lg text-gray-900 overflow-hidden";
const SELECT_ITEM = "hover:bg-sky-50 hover:text-[#3C8DBC] data-[highlighted]:bg-sky-50 data-[highlighted]:text-[#3C8DBC] cursor-pointer font-medium text-xs px-4 py-2.5 focus:outline-none transition-colors";

export default function ApplyForm() {
  const navigate = useNavigate();
  const { addApplication } = useAppData();
  const { t, lang } = useLanguage();
  const [collapsed, setCollapsed] = useState(isMobileViewport);
  const wasMobile = useRef(isMobileViewport());

  useEffect(() => {
    function handleResize() {
      const mobileNow = isMobileViewport();
      if (mobileNow !== wasMobile.current) {
        wasMobile.current = mobileNow;
        setCollapsed(mobileNow);
      }
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const STEPS = [
    t("step_business"),
    t("step_applicant"),
    t("step_service"),
    t("step_documents"),
    t("step_review"),
  ];

  const [appType, setAppType] = useState(null);
  const [renewalRef, setRenewalRef] = useState("");
  const [renewalLookupStatus, setRenewalLookupStatus] = useState("idle");
  const [renewalLookupError, setRenewalLookupError] = useState("");
  const [renewalRecord, setRenewalRecord] = useState(null);
  const [renewalSubmitting, setRenewalSubmitting] = useState(false);
  const [renewalSubmitError, setRenewalSubmitError] = useState("");

  async function handleRenewalLookup() {
    setRenewalLookupStatus("loading");
    setRenewalLookupError("");
    setRenewalRecord(null);
    try {
      const data = await api.renewalLookup(renewalRef.trim());
      setRenewalRecord(data);
      setRenewalLookupStatus("found");
    } catch (err) {
      setRenewalLookupStatus("error");
      setRenewalLookupError(
        err.status === 403 ? t("renewal_wrongOwner") : t("renewal_notFound"),
      );
    }
  }

  async function handleQuickRenewSubmit() {
    setRenewalSubmitting(true);
    setRenewalSubmitError("");
    try {
      const app = await addApplication({
        applicationType: "renewal",
        renewalOf: renewalRef.trim(),
      });
      setAppType("renewal");
      setSubmitted(app);
      setRenewalRecord(null);
      toast.success("Renewal submitted successfully!");
    } catch (err) {
      console.error("Renewal submit error:", err);
      const msg = err.message || "Something went wrong. Please try again.";
      setRenewalSubmitError(msg);
      toast.error(msg);
    } finally {
      setRenewalSubmitting(false);
    }
  }

  function handleStartRenewal() {
    setAppType("renewal");
    setFullName(renewalRecord.applicantInfo?.fullName || "");
    setGender(renewalRecord.applicantInfo?.gender || "");
    setDob(renewalRecord.applicantInfo?.dob || "");
    setPhone(renewalRecord.applicantInfo?.phone || "");
    setRegion(renewalRecord.applicantInfo?.address?.region || "");
    setWoreda(renewalRecord.applicantInfo?.address?.woreda || "");
    setKebele(renewalRecord.applicantInfo?.address?.kebele || "");
    setHouseNo(renewalRecord.applicantInfo?.address?.houseNo || "");
    setPoBox(renewalRecord.applicantInfo?.address?.poBox || "");
    setFax(renewalRecord.applicantInfo?.address?.fax || "");
    setEmail(renewalRecord.applicantInfo?.address?.email || "");
    setLicenseOwnerAddress(renewalRecord.applicantInfo?.address?.licenseOwnerAddress || "");
    setHasTradeLicense(renewalRecord.hasTradeLicense || false);
    setTin(renewalRecord.tin || "");
    setBusinessName(renewalRecord.businessName || "");
    setServiceTypeId(renewalRecord.serviceType?.id || renewalRecord.serviceType?._id || "");
    setStep(0);
    toast.info("Please review your pre-filled details and complete the steps to submit your renewal.");
  }

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [errorOpen, setErrorOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [step, setStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [fullName, setFullName] = useState("");
  const [gender, setGender] = useState("");
  const [dob, setDob] = useState("");
  const [phone, setPhone] = useState("");

  const [region, setRegion] = useState("");
  const [woreda, setWoreda] = useState("");
  const [kebele, setKebele] = useState("");
  const [houseNo, setHouseNo] = useState("");
  const [poBox, setPoBox] = useState("");
  const [fax, setFax] = useState("");
  const [email, setEmail] = useState("");
  const [licenseOwnerAddress, setLicenseOwnerAddress] = useState("");

  const [hasTradeLicense, setHasTradeLicense] = useState(false);
  const [tin, setTin] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [fetchingTin, setFetchingTin] = useState(false);

  const [serviceTypeId, setServiceTypeId] = useState("");

  const [serviceTypes, setServiceTypes] = useState([]);
  const [serviceTypesLoading, setServiceTypesLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    api
      .serviceTypes()
      .then((collection) => {
        if (!cancelled) {
          const items = collection && Array.isArray(collection.items)
            ? collection.items
            : [];
          setServiceTypes(items);
          setServiceTypesLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error("Failed to load service types", err);
          setServiceTypes([]);
          setServiceTypesLoading(false);
          toast.error("Couldn't load service types. Please try again.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const [photo, setPhoto] = useState(null);
  const [education, setEducation] = useState(null);
  const [tradeLicenseFile, setTradeLicenseFile] = useState(null);
  const [otherFiles, setOtherFiles] = useState([]);

  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(null);
  const [submitError, setSubmitError] = useState("");

  const serviceType = serviceTypes.find((s) => s.id === serviceTypeId) || null;

  function validateStep(i) {
    const e = {};
    if (i === 0) {
      if (hasTradeLicense) {
        if (!tin.trim()) e.tin = t("required");
      }
    }
    if (i === 1) {
      if (!fullName.trim()) e.fullName = t("required");
      if (!gender) e.gender = t("required");
      if (!dob) e.dob = t("required");
      if (!region.trim()) e.region = t("required");
      if (!woreda.trim()) e.woreda = t("required");
      if (!kebele.trim()) e.kebele = t("required");
      if (!phone.trim()) e.phone = t("required");
      if (!email.trim()) e.email = t("required");
      if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
        e.email = t("required");
      if (!licenseOwnerAddress.trim()) e.licenseOwnerAddress = t("required");
    }
    if (i === 2 && !serviceTypeId) {
      e.serviceCode = t("required");
    }
    if (i === 3) {
      if (appType !== "renewal") {
        if (!photo) e.photo = t("required");
        if (!education) e.education = t("required");
        if (hasTradeLicense && !tradeLicenseFile)
          e.tradeLicenseFile = t("required");
      }
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function goNext() {
    if (!validateStep(step)) return;

    if (step === 0 && hasTradeLicense && appType !== "renewal") {
      setFetchingTin(true);
      try {
        const data = await api.businessRegistration(tin);
        if (data.businessName) setBusinessName(data.businessName);
        if (data.ownerName) setFullName(data.ownerName);
        if (data.region) setRegion(data.region);
        if (data.woreda) setWoreda(data.woreda);
        if (data.kebele) setKebele(data.kebele);
        if (data.houseNo) setHouseNo(data.houseNo);
        if (data.phone) setPhone(data.phone);

        setStep((s) => Math.min(s + 1, STEPS.length - 1));
        window.scrollTo({ top: 0, behavior: "smooth" });
      } catch (err) {
        setErrors({ tin: err.message || t("businessRecordNotFound") });
      } finally {
        setFetchingTin(false);
      }
      return;
    }

    setStep((s) => Math.min(s + 1, STEPS.length - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function goBack() {
    setStep((s) => Math.max(s - 1, 0));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function goToStep(i) {
    setStep(i);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmit() {
    const allValid = [0, 1, 2, 3].every((i) => validateStep(i));
    if (!allValid) return;

    if (isSubmitting) return;
    setIsSubmitting(true);
    setSubmitError("");
    try {
      const app = await addApplication({
        applicationType: appType === "renewal" ? "renewal" : "new",
        renewalOf: appType === "renewal" ? renewalRef.trim() : undefined,
        applicantInfo: {
          fullName,
          gender,
          dob,
          phone,
          address: { region, woreda, kebele, houseNo, poBox, fax, email, licenseOwnerAddress },
        },
        hasTradeLicense,
        tin: hasTradeLicense ? tin : null,
        businessName: hasTradeLicense ? businessName : null,
        serviceType,
        files: {
          photo,
          education,
          tradeLicense: tradeLicenseFile,
          others: otherFiles,
        },
      });

      setSubmitted(app);
      toast.success(t("submissionReceived") || "Submitted successfully!");
    } catch (err) {
      const msg =
        err.message ||
        "Something went wrong submitting your application. Please try again.";
      setSubmitError(msg);
      setErrorMsg(msg);
      setErrorOpen(true);
    } finally {
      setIsSubmitting(false);
    }
  }

  const shell = (content) => (
    <div className="h-screen flex flex-col bg-[#1A2226] text-white">
      <ApplicantNavbar onToggleSidebar={() => setCollapsed((c) => !c)} />
      <div className="flex-1 flex overflow-hidden">
        <ApplicantSidebar collapsed={collapsed} />
        <div className="flex-1 flex flex-col overflow-hidden">
          <main className="flex-1 overflow-y-auto bg-[#D2D6DE] text-[#212121] flex flex-col">
            <div className="flex-1 p-6">
              {content}
            </div>
            <ApplicantFooter />
          </main>
        </div>
      </div>

      <Dialog.Root open={errorOpen} onOpenChange={setErrorOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-[420px] bg-white rounded-xl shadow-2xl border border-gray-200 p-6 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
            <div className="flex justify-center mb-4">
              <div className="w-14 h-14 rounded-full bg-rose-50 flex items-center justify-center">
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#e11d48"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
            </div>
            <Dialog.Title className="text-xl font-bold text-gray-900 text-center mb-1">
              Submission Failed
            </Dialog.Title>
            <Dialog.Description className="text-xs font-medium text-gray-500 text-center mb-5 leading-relaxed">
              {errorMsg}
            </Dialog.Description>
            <Dialog.Close asChild>
              <button className="w-full h-10 bg-[#3C8DBC] hover:bg-[#357ca5] text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-all shadow-md active:scale-[0.98] cursor-pointer">
                OK, I'll fix it
              </button>
            </Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Toaster position="top-right" richColors />

      <Dialog.Root open={confirmOpen} onOpenChange={setConfirmOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-[420px] bg-white rounded-xl shadow-2xl border border-gray-200 p-6 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">

            <div className="flex justify-center mb-4">
              <div className="w-14 h-14 rounded-full bg-sky-50 flex items-center justify-center">
                <Send size={24} className="text-[#3C8DBC]" />
              </div>
            </div>

            <Dialog.Title className="text-xl font-bold text-gray-900 text-center mb-1">
              Confirm Submission
            </Dialog.Title>
            <Dialog.Description className="text-xs text-gray-600 text-center mb-5 font-medium">
              {appType === "renewal" ? (
                <>
                  You are submitting a{" "}
                  <span className="font-semibold text-amber-600">renewal</span>{" "}
                  for reference{" "}
                  <span className="font-mono font-semibold text-gray-900">
                    {renewalRef}
                  </span>
                  .
                </>
              ) : (
                <>
                  You are submitting a{" "}
                  <span className="font-semibold text-[#3C8DBC]">
                    new application
                  </span>{" "}
                  for{" "}
                  <span className="font-semibold text-gray-900">
                    {fullName}
                  </span>
                  .
                </>
              )}
              <br />
              <span className="text-[11px] text-gray-400">
                This cannot be undone once submitted.
              </span>
            </Dialog.Description>

            <div className="flex gap-3">
              <Dialog.Close asChild>
                <button className="flex-1 h-10 border border-gray-300 bg-white text-gray-700 rounded-lg text-xs font-semibold uppercase tracking-wider hover:bg-gray-50 active:scale-[0.98] transition-all shadow-xs cursor-pointer">
                  Cancel
                </button>
              </Dialog.Close>
              <button
                onClick={() => {
                  setConfirmOpen(false);
                  handleSubmit();
                }}
                disabled={isSubmitting}
                className="flex-1 h-10 bg-[#3C8DBC] hover:bg-[#357ca5] text-white rounded-lg text-xs font-bold uppercase tracking-wider shadow-md hover:shadow-lg active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? "Submitting..." : "Yes, Submit"}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );

  if (!appType) {
    return shell(
      <div className="max-w-[850px] mx-auto py-8 sm:py-14 px-4 sm:px-6 relative z-0">
        <div className="relative z-10 bg-white rounded-lg border border-gray-200 shadow-lg p-6 sm:p-10">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="text-center mb-8"
          >
            <p className="text-xs text-[#3C8DBC] font-extrabold uppercase tracking-widest mb-1.5">
              {t("newSubmission")}
            </p>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 leading-tight mb-2">
              {t("chooseAppType")}
            </h1>
            <p className="text-xs text-gray-600 max-w-md mx-auto font-medium leading-relaxed">
              {lang === "am"
                ? "እባክዎን ከታች ካሉት አማራጮች ለማመልከት የሚፈልጉትን የማመልከቻ አይነት ይምረጡ።"
                : "Please select the appropriate application pathway below to begin your verification process."}
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 gap-6 relative mt-6">
            <button
              onClick={() => setAppType("new")}
              className="group relative flex flex-col justify-between text-left bg-white border border-gray-200/80 rounded-lg p-6 sm:p-7 shadow-md hover:shadow-lg hover:border-sky-300 active:scale-[0.99] transition-all cursor-pointer"
            >
              <div>
                <div className="flex items-center justify-between mb-5">
                  <div className="h-11 w-11 rounded-md bg-[#1B2A4A] text-white flex items-center justify-center shadow-xs">
                    <UserPlus size={22} />
                  </div>
                  <span className="text-xs font-bold uppercase text-[#3C8DBC] tracking-wider">
                    Recommended
                  </span>
                </div>

                <h3 className="text-lg font-bold text-gray-900 mb-2 group-hover:text-[#3C8DBC] transition-colors">
                  {t("appType_new")}
                </h3>
                <p className="text-xs text-gray-600 leading-relaxed mb-5 font-medium">
                  {t("appType_new_desc")}
                </p>
              </div>

              <div className="pt-4 border-t border-gray-100 w-full">
                <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-2">What you'll need:</p>
                <ul className="text-xs text-gray-700 space-y-1.5 font-medium">
                  <li className="flex items-center gap-2">
                    <span className="text-[#3C8DBC] font-bold">✓</span> TIN &amp; Business Details
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-[#3C8DBC] font-bold">✓</span> Educational Credentials
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-[#3C8DBC] font-bold">✓</span> Recent Photograph
                  </li>
                </ul>
                <div className="mt-4 flex items-center justify-between text-[#3C8DBC] text-xs font-bold uppercase tracking-wider group-hover:translate-x-1 transition-transform">
                  <span>Start New Request</span>
                  <ArrowRight size={16} />
                </div>
              </div>
            </button>

            <button
              onClick={() => setAppType("existing")}
              className="group relative flex flex-col justify-between text-left bg-white border border-gray-200/80 rounded-lg p-6 sm:p-7 shadow-md hover:shadow-lg hover:border-sky-300 active:scale-[0.99] transition-all cursor-pointer"
            >
              <div>
                <div className="flex items-center justify-between mb-5">
                  <div className="h-11 w-11 rounded-md bg-[#1B2A4A] text-white flex items-center justify-center shadow-xs">
                    <RefreshCw size={22} />
                  </div>
                  <span className="text-xs font-bold uppercase text-gray-500 tracking-wider">
                    Renewal
                  </span>
                </div>

                <h3 className="text-lg font-bold text-gray-900 mb-2 group-hover:text-[#3C8DBC] transition-colors">
                  {t("appType_existing")}
                </h3>
                <p className="text-xs text-gray-600 leading-relaxed mb-5 font-medium">
                  {t("appType_existing_desc")}
                </p>
              </div>

              <div className="pt-4 border-t border-gray-100 w-full">
                <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-2">What you'll need:</p>
                <ul className="text-xs text-gray-700 space-y-1.5 font-medium">
                  <li className="flex items-center gap-2">
                    <span className="text-[#3C8DBC] font-bold">✓</span> Previous Reference No.
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-[#3C8DBC] font-bold">✓</span> Updated Trade License
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-[#3C8DBC] font-bold">✓</span> Current Photo
                  </li>
                </ul>
                <div className="mt-4 flex items-center justify-between text-[#3C8DBC] text-xs font-bold uppercase tracking-wider group-hover:translate-x-1 transition-transform">
                  <span>Renew Certificate</span>
                  <ArrowRight size={16} />
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>,
    );
  }

  if (appType === "existing") {
    return shell(
      <div className="max-w-[540px] mx-auto py-8 px-4">
        <button
          onClick={() => {
            setAppType(null);
            setRenewalLookupStatus("idle");
            setRenewalRecord(null);
            setRenewalRef("");
          }}
          className="flex items-center gap-2 text-xs font-bold text-gray-700 bg-white border border-gray-300 rounded-lg px-4 py-2 mb-6 shadow-xs hover:bg-gray-50 active:scale-[0.98] transition-all cursor-pointer"
        >
          <ArrowLeft size={16} /> {t("back")}
        </button>

        <div className="mb-6">
          <p className="text-xs font-bold uppercase tracking-wider text-[#3C8DBC] mb-1">
            {t("appType_existing")}
          </p>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
            {t("renewal_title")}
          </h1>
        </div>

        <section className={SECTION}>
          <div className="space-y-3 mb-2">
            <label className={LABEL} htmlFor="renewalRef">
              {t("renewal_refLabel")}
            </label>
            <div className="flex flex-col sm:flex-row gap-3">
              <Input
                id="renewalRef"
                value={renewalRef}
                onChange={(e) => {
                  setRenewalRef(e.target.value);
                  setRenewalLookupStatus("idle");
                  setRenewalRecord(null);
                }}
                placeholder={t("renewal_refPlaceholder")}
                className={INPUT}
              />
              <Button
                type="button"
                onClick={handleRenewalLookup}
                disabled={
                  !renewalRef.trim() || renewalLookupStatus === "loading"
                }
                className="shrink-0 bg-[#3C8DBC] hover:bg-[#357ca5] text-white font-bold text-xs uppercase tracking-wider rounded-lg px-6 h-10 shadow-md active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
              >
                <Search size={14} />
                {renewalLookupStatus === "loading"
                  ? t("renewal_lookingUp")
                  : t("renewal_lookup")}
              </Button>
            </div>
            {renewalLookupStatus === "error" && (
              <p className="text-rose-600 font-semibold text-xs mt-2">
                {renewalLookupError}
              </p>
            )}
          </div>
        </section>

        <Dialog.Root open={!!renewalRecord} onOpenChange={(open) => { if (!open) setRenewalRecord(null); }}>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
            <Dialog.Content className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-[480px] bg-white border border-gray-200/80 p-6 sm:p-8 rounded-2xl shadow-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
              <div className="flex justify-center mb-4">
                <div className="w-14 h-14 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-center shadow-xs">
                  <CheckCircle2 size={28} className="text-emerald-600" />
                </div>
              </div>
              <Dialog.Title className="text-xl font-extrabold text-gray-900 text-center mb-1.5 tracking-tight">
                Certificate Found!
              </Dialog.Title>
              <Dialog.Description className="text-xs font-medium text-gray-600 text-center mb-6">
                We verified the record for <strong className="text-gray-900 font-bold">{renewalRef}</strong>.
              </Dialog.Description>

              <div className="space-y-3 mb-6 bg-sky-50/50 border border-sky-100 rounded-xl p-4 shadow-xs">
                <div className="flex items-start justify-between gap-4 border-b border-sky-100/80 pb-2.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-500 shrink-0">
                    Holder Name
                  </span>
                  <span className="text-xs font-bold text-gray-900 text-right flex-1">
                    {renewalRecord?.holderName}
                  </span>
                </div>

                <div className="flex items-start justify-between gap-4 border-b border-sky-100/80 pb-2.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-500 shrink-0">
                    Service
                  </span>
                  <span className="text-xs font-bold text-gray-900 text-right flex-1 leading-snug">
                    {lang === "am" ? renewalRecord?.serviceType?.nameAm : renewalRecord?.serviceType?.name}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-500 shrink-0">
                    Latest Year
                  </span>
                  <span className="font-mono text-xs font-bold text-gray-900 text-right flex-1">
                    {renewalRecord?.latestYear}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                {renewalSubmitError && (
                  <p className="text-rose-600 text-xs text-center font-bold">
                    {renewalSubmitError}
                  </p>
                )}
                <button
                  onClick={handleQuickRenewSubmit}
                  disabled={renewalSubmitting}
                  className="w-full flex items-center justify-center gap-2 bg-[#3C8DBC] hover:bg-[#357ca5] text-white font-bold text-xs uppercase tracking-wider rounded-lg px-4 py-3 shadow-md hover:shadow-lg active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
                >
                  <CheckCircle2 size={16} /> Quick Submit
                </button>

                <div className="flex gap-3">
                  <Dialog.Close asChild>
                    <button className="flex-1 font-bold text-xs uppercase tracking-wider text-gray-700 bg-white border border-gray-300 rounded-lg px-4 py-2.5 shadow-xs hover:bg-gray-50 active:scale-[0.98] transition-all cursor-pointer">
                      Cancel
                    </button>
                  </Dialog.Close>
                  <button
                    onClick={handleStartRenewal}
                    className="flex-1 flex items-center justify-center gap-2 bg-[#1E293B] hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-wider rounded-lg px-4 py-2.5 shadow-md active:scale-[0.98] transition-all cursor-pointer"
                  >
                    Review &amp; Update <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </div>,
    );
  }

  if (submitted) {
    return shell(
      <div className="max-w-[520px] mx-auto text-center py-16 px-4">
        <div className="mb-4 bg-emerald-50 w-16 h-16 rounded-2xl border border-emerald-200 flex items-center justify-center mx-auto shadow-xs">
          <CheckCircle2 size={32} className="text-emerald-600" />
        </div>
        <p className="text-xs font-bold uppercase tracking-wider text-emerald-800 mb-2">
          {appType === "renewal" || appType === "existing"
            ? t("renewal_success")
            : t("submissionReceived")}
        </p>
        <h1 className="text-2xl font-extrabold text-gray-900 mb-3 font-mono">
          {submitted.id}
        </h1>
        <p className="text-xs sm:text-sm text-gray-600 mb-8 leading-relaxed font-medium">
          {appType === "renewal" || appType === "existing"
            ? t("renewal_successBody", { ref: renewalRef })
            : t("submissionBody", { service: submitted.serviceType?.name })}
        </p>
        <Button
          onClick={() => navigate("/applicant/dashboard")}
          className="bg-[#3C8DBC] hover:bg-[#357ca5] text-white font-bold text-xs uppercase tracking-wider rounded-lg px-6 py-3 shadow-md hover:shadow-lg active:scale-[0.98] transition-all cursor-pointer"
        >
          <CheckCircle2 size={16} /> {t("goToDashboard")}
        </Button>
      </div>,
    );
  }

  return shell(
    <div className="max-w-[780px] mx-auto py-6 sm:py-8 px-4 sm:px-6">
      <button
        onClick={() => setAppType(null)}
        className="flex items-center gap-2 text-xs font-bold text-gray-700 bg-white border border-gray-300 rounded-lg px-4 py-2 mb-6 shadow-xs hover:bg-gray-50 active:scale-[0.98] transition-all cursor-pointer"
      >
        <ArrowLeft size={16} /> {t("back")}
      </button>
      <div className="mb-8">
        <p className="text-xs font-bold uppercase tracking-wider text-[#3C8DBC] mb-1">
          {appType === "renewal" ? "Renewal Application" : t("newSubmission")}
        </p>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight leading-tight">
          {appType === "renewal" ? `Renewing: ${renewalRef}` : t("formTitle")}
        </h1>
        {appType === "renewal" && (
          <p className="text-xs font-medium text-gray-600 mt-1.5 leading-relaxed">
            Your existing details have been pre-filled. Please click "Next" to review each step, update any information or documents if needed, and submit at the end.
          </p>
        )}
      </div>

      <div className="mb-12">
        <Stepper steps={STEPS} currentStep={step} />
      </div>

      {step === 0 && (
        <section className={SECTION}>
          <div className="mb-8 border-b border-gray-100 pb-4">
            <h2 className={`${HEADING} mb-2`}>{t("businessInfoTitle")}</h2>
            <p className="font-sans text-[14px] text-gray-500">
              {t("businessInfoHint")}
            </p>
          </div>

          <div
            onClick={() => setHasTradeLicense(!hasTradeLicense)}
            className={`flex items-center gap-4 p-5 rounded-xl border cursor-pointer transition-all mb-6 ${hasTradeLicense
              ? "bg-sky-50/60 border-[#3C8DBC] shadow-xs"
              : "bg-white border-gray-200 shadow-xs hover:border-gray-300"
              }`}
          >
            <div
              className={`w-5 h-5 rounded-md shrink-0 flex items-center justify-center transition-colors ${hasTradeLicense ? "bg-[#3C8DBC] text-white" : "bg-white border border-gray-300"
                }`}
            >
              {hasTradeLicense && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              )}
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900 mb-0.5">
                {t("hasTradeLicense")}
              </p>
              <p className="text-xs text-gray-600 leading-snug font-medium">
                {t("hasTradeLicenseDesc")}
              </p>
            </div>
          </div>

          {hasTradeLicense && (
            <div className="space-y-5">
              <div>
                <label className={LABEL} htmlFor="tin">
                  {t("tinNumber")}
                </label>
                <Input
                  id="tin"
                  value={tin}
                  onChange={(e) => setTin(e.target.value)}
                  placeholder={t("tinPlaceholder")}
                  className={INPUT}
                />
                {errors.tin && (
                  <p className="text-rose-600 font-semibold text-xs mt-1.5">
                    {errors.tin}
                  </p>
                )}
                <p className="text-xs text-gray-500 mt-1.5 font-medium">
                  {t("tin_verifyHint")}
                </p>
              </div>
            </div>
          )}

        </section>
      )}

      {step === 1 && (
        <section className={`${SECTION} space-y-6`}>
          <h2 className={`${HEADING} mb-5`}>{t("applicantInfoTitle")}</h2>
          <div className="grid sm:grid-cols-2 gap-5">
            <div className="sm:col-span-2 space-y-1.5">
              <Label htmlFor="fullName" className={LABEL}>
                {t("fullName")}
              </Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className={INPUT}
              />
              {errors.fullName && (
                <p className="text-rose-600 text-xs font-semibold">{errors.fullName}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="gender" className={LABEL}>
                {t("gender")}
              </Label>
              <Select value={gender} onValueChange={setGender}>
                <SelectTrigger id="gender" className={SELECT_TRIGGER}>
                  <SelectValue placeholder={t("select")} />
                </SelectTrigger>
                <SelectContent className={SELECT_CONTENT}>
                  <SelectItem value="male" className={SELECT_ITEM}>
                    {t("male")}
                  </SelectItem>
                  <SelectItem value="female" className={SELECT_ITEM}>
                    {t("female")}
                  </SelectItem>
                </SelectContent>
              </Select>
              {errors.gender && (
                <p className="text-rose-600 text-xs font-semibold">{errors.gender}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="dob" className={LABEL}>
                {t("dob")}
              </Label>
              <EthiopianDobPicker value={dob} onChange={setDob} lang={lang} className={INPUT} />
              {errors.dob && (
                <p className="text-rose-600 text-xs font-semibold">{errors.dob}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="phone" className={LABEL}>
                {t("phone")}
              </Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+251"
                className={INPUT}
              />
              {errors.phone && (
                <p className="text-rose-600 text-xs font-semibold">{errors.phone}</p>
              )}
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="licenseOwnerAddress" className={LABEL}>
                {t("licenseOwnerAddress")}
              </Label>
              <Input
                id="licenseOwnerAddress"
                value={licenseOwnerAddress}
                onChange={(e) => setLicenseOwnerAddress(e.target.value)}
                placeholder={t("licenseOwnerAddressPlaceholder")}
                className={INPUT}
              />
              {errors.licenseOwnerAddress && (
                <p className="text-rose-600 text-xs font-semibold">{errors.licenseOwnerAddress}</p>
              )}
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-4">
              {t("addressTitle")}
            </p>
            <div className="grid sm:grid-cols-3 gap-5">
              {[
                {
                  id: "region",
                  val: region,
                  set: setRegion,
                  err: errors.region,
                  label: t("region"),
                },
                {
                  id: "woreda",
                  val: woreda,
                  set: setWoreda,
                  err: errors.woreda,
                  label: t("woreda"),
                },
                {
                  id: "kebele",
                  val: kebele,
                  set: setKebele,
                  err: errors.kebele,
                  label: t("kebele"),
                },
                {
                  id: "houseNo",
                  val: houseNo,
                  set: setHouseNo,
                  err: null,
                  label: t("houseNo"),
                },
                {
                  id: "poBox",
                  val: poBox,
                  set: setPoBox,
                  err: null,
                  label: t("poBox"),
                },
                {
                  id: "fax",
                  val: fax,
                  set: setFax,
                  err: null,
                  label: t("fax"),
                },
              ].map(({ id, val, set, err, label }) => (
                <div key={id} className="space-y-1.5">
                  <Label htmlFor={id} className={LABEL}>
                    {label}
                  </Label>
                  <Input
                    id={id}
                    value={val}
                    onChange={(e) => set(e.target.value)}
                    className={INPUT}
                  />
                  {err && <p className="text-rose-600 text-xs font-semibold">{err}</p>}
                </div>
              ))}
              <div className="sm:col-span-3 space-y-1.5">
                <Label htmlFor="email" className={LABEL}>
                  {t("email")} <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={INPUT}
                />
                {errors.email && (
                  <p className="text-rose-600 text-xs font-semibold">{errors.email}</p>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {step === 2 && (
        <section className={SECTION}>
          <h2 className={`${HEADING} mb-5`}>{t("serviceTypeTitle")}</h2>
          <div className="space-y-1.5">
            <Label htmlFor="serviceType" className={LABEL}>
              {t("serviceTypeSelectLabel")}
            </Label>
            <Select value={serviceTypeId} onValueChange={setServiceTypeId}>
              <SelectTrigger id="serviceType" className={SELECT_TRIGGER}>
                <SelectValue placeholder={t("selectServiceType")} />
              </SelectTrigger>
              <SelectContent className={SELECT_CONTENT}>
                {serviceTypes.map((s, i) => (
                  <SelectItem key={s.id} value={s.id} className={SELECT_ITEM}>
                    {i + 1}. {lang === "am" ? s.nameAm : s.name}
                    {s.tier ? ` : ${s.tier}` : ""} ({s.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.serviceCode && (
              <p className="text-rose-600 text-xs font-semibold mt-1">
                {errors.serviceCode}
              </p>
            )}
          </div>
          {serviceType && (
            <div className="mt-4 p-4 bg-white border border-gray-200/90 rounded-xl shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  {t("serviceCode")}: <span className="font-extrabold text-black">{serviceType.code}</span>
                </p>
                <p className="text-sm font-bold text-gray-900 mt-0.5">
                  {lang === "am" ? serviceType.name : serviceType.nameAm}
                </p>
              </div>
            </div>
          )}
        </section>
      )}

      {step === 3 && (
        <section className={SECTION}>
          <div className="mb-6 pb-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className={`${HEADING} mb-1`}>{t("documentsTitle")}</h2>
              <p className="text-xs text-gray-500 font-medium">
                {t("documentsHint")}
              </p>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {["PDF", "JPG", "PNG", "DOCX"].map((ext) => (
                <span key={ext} className="text-[10px] font-mono font-extrabold uppercase px-2 py-0.5 bg-gray-100 text-gray-800 rounded-md border border-gray-300 shadow-2xs">
                  .{ext}
                </span>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <FileDrop
                label={t("applicantPhoto")}
                required
                preview
                accept=".jpg,.jpeg,.png"
                file={photo}
                onChange={setPhoto}
                allowCamera={false}
              />
              {errors.photo && (
                <p className="text-rose-600 text-xs font-semibold mt-1.5">
                  {errors.photo}
                </p>
              )}
            </div>

            <div>
              <FileDrop
                label={t("educationCertificate")}
                required
                accept=".pdf,.jpg,.jpeg,.png,.docx"
                file={education}
                onChange={setEducation}
                allowCamera={false}
              />
              {errors.education && (
                <p className="text-rose-600 text-xs font-semibold mt-1.5">
                  {errors.education}
                </p>
              )}
            </div>

            {hasTradeLicense && (
              <div>
                <FileDrop
                  label={t("tradeLicense")}
                  required
                  accept=".pdf,.jpg,.jpeg,.png"
                  hint={t("tradeLicenseHint")}
                  file={tradeLicenseFile}
                  onChange={setTradeLicenseFile}
                  allowCamera={false}
                />
                {errors.tradeLicenseFile && (
                  <p className="text-rose-600 text-xs font-semibold mt-1.5">
                    {errors.tradeLicenseFile}
                  </p>
                )}
              </div>
            )}

            <div className="pt-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-gray-900">
                    {t("otherDocuments")}
                  </span>
                  <span className="text-[11px] font-medium text-gray-400">
                    (Optional supplementary files)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => document.getElementById("otherFilesInput")?.click()}
                    className="flex items-center justify-center gap-2 bg-[#3C8DBC] hover:bg-[#357ca5] text-white text-xs font-bold px-5 py-2.5 rounded-lg shadow-md shadow-slate-900/25 hover:shadow-lg active:scale-[0.97] transition-all cursor-pointer border border-sky-600/30 shrink-0 whitespace-nowrap min-w-[110px]"
                  >
                    <Upload size={14} className="stroke-[2.5] shrink-0" />
                    <span>Browse</span>
                  </button>
                </div>
                <input
                  id="otherFilesInput"
                  type="file"
                  multiple
                  accept=".pdf,.jpg,.jpeg,.png,.docx"
                  className="hidden"
                  onChange={(e) => {
                    const picked = Array.from(e.target.files || []);
                    setOtherFiles((prev) => {
                      const names = new Set(prev.map((f) => f.name));
                      return [
                        ...prev,
                        ...picked.filter((f) => !names.has(f.name)),
                      ];
                    });
                    e.target.value = "";
                  }}
                />
              </div>

              {otherFiles.length > 0 && (
                <div className="mt-3 grid sm:grid-cols-2 gap-2.5">
                  {otherFiles.map((f, i) => (
                    <div
                      key={f.name}
                      className="flex items-center justify-between bg-white border border-gray-200/90 rounded-xl p-2.5 shadow-2xs hover:border-gray-300 transition-all"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="size-8 rounded-lg bg-sky-50 border border-sky-200 flex items-center justify-center text-[#3C8DBC] shrink-0 font-mono text-[10px] font-extrabold uppercase">
                          {f.name.split(".").pop() || "DOC"}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-gray-900 truncate">
                            {f.name}
                          </p>
                          <p className="text-[10px] font-mono text-gray-400">
                            {(f.size / 1024).toFixed(0)} KB
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setOtherFiles((prev) =>
                            prev.filter((_, j) => j !== i),
                          )
                        }
                        title="Remove"
                        className="p-1 rounded-lg text-rose-500 hover:bg-rose-50 transition-colors shrink-0 ml-2"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {step === 4 && (
        <section className={`${SECTION} space-y-6`}>
          <h2 className={HEADING}>{t("reviewTitle")}</h2>

          <ReviewBlock
            title={t("businessInfoTitle")}
            editLabel={t("edit")}
            onEdit={() => goToStep(0)}
          >
            {hasTradeLicense ? (
              <>
                <ReviewRow label={t("tinNumber")} value={tin} mono />
                <ReviewRow
                  label={t("businessName")}
                  value={businessName || "-"}
                />
              </>
            ) : (
              <ReviewRow label={t("tradeLicense")} value={t("notProvided")} />
            )}
          </ReviewBlock>

          <ReviewBlock
            title={t("applicantInfoTitle")}
            editLabel={t("edit")}
            onEdit={() => goToStep(1)}
          >
            <ReviewRow label={t("fullName")} value={fullName} />
            <ReviewRow
              label={t("gender")}
              value={
                gender === "male"
                  ? t("male")
                  : gender === "female"
                    ? t("female")
                    : "-"
              }
            />
            <ReviewRow label={t("dob")} value={dob || "-"} />
            <ReviewRow label={t("phone")} value={phone} />
            <ReviewRow label={t("region")} value={region} />
            <ReviewRow label={t("woreda")} value={woreda} />
            <ReviewRow label={t("kebele")} value={kebele} />
            <ReviewRow label={t("houseNo")} value={houseNo || "-"} />
            <ReviewRow label={t("poBox")} value={poBox || "-"} />
            <ReviewRow label={t("fax")} value={fax || "-"} />
            <ReviewRow label={t("email")} value={email || "-"} />
          </ReviewBlock>

          <ReviewBlock
            title={t("serviceTypeTitle")}
            editLabel={t("edit")}
            onEdit={() => goToStep(2)}
          >
            <ReviewRow
              label={t("service")}
              value={
                serviceType
                  ? lang === "am"
                    ? serviceType.nameAm
                    : serviceType.name
                  : "-"
              }
            />
            <ReviewRow
              label={t("serviceCode")}
              value={serviceType?.code || "-"}
              mono
            />
          </ReviewBlock>

          <ReviewBlock
            title={t("documentsTitle")}
            editLabel={t("edit")}
            onEdit={() => goToStep(3)}
          >
            <ReviewRow label={t("applicantPhoto")} value={photo?.name || "-"} />
            <ReviewRow
              label={t("educationCertificate")}
              value={education?.name || "-"}
            />
            {hasTradeLicense && (
              <ReviewRow
                label={t("tradeLicense")}
                value={tradeLicenseFile?.name || "-"}
              />
            )}
            {otherFiles.length > 0 && (
              <ReviewRow
                label={t("otherDocuments")}
                value={otherFiles.map((f) => f.name).join(", ")}
              />
            )}
          </ReviewBlock>
        </section>
      )}

      <div className="flex justify-between items-center mt-8 pt-6 border-t border-gray-100">
        <Button
          type="button"
          onClick={goBack}
          disabled={step === 0}
          className={`px-5 py-2.5 bg-white border border-gray-300 text-xs font-bold text-gray-700 rounded-lg shadow-xs hover:bg-gray-50 active:scale-[0.98] transition-all cursor-pointer ${step === 0 ? "opacity-0 pointer-events-none" : ""}`}
        >
          <ArrowLeft size={16} /> {t("back")}
        </Button>

        {step < STEPS.length - 1 ? (
          <Button
            type="button"
            onClick={goNext}
            disabled={fetchingTin}
            className="px-6 py-2.5 bg-[#3C8DBC] hover:bg-[#357ca5] text-white text-xs font-bold uppercase tracking-wider rounded-lg shadow-md hover:shadow-lg active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
          >
            {fetchingTin ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                {t("verifying")}...
              </span>
            ) : (
              <>{t("continue")} <ArrowRight size={16} /></>
            )}
          </Button>
        ) : (
          <div className="text-right">
            {submitError && (
              <p className="text-rose-600 font-semibold text-xs mb-2">{submitError}</p>
            )}
            <Button
              type="button"
              onClick={() => {
                const invalidStep = [0, 1, 2, 3].find((i) => !validateStep(i));
                if (invalidStep !== undefined) {
                  setStep(invalidStep);
                  toast.error(t("pleaseFillRequired") || "Please complete all required fields before submitting.");
                } else {
                  setConfirmOpen(true);
                }
              }}
              disabled={isSubmitting}
              className="px-6 py-2.5 bg-[#3C8DBC] hover:bg-[#357ca5] text-white text-xs font-bold uppercase tracking-wider rounded-lg shadow-md hover:shadow-lg active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
            >
              <Send size={15} /> {isSubmitting ? "Submitting..." : t("submitApplication")}
            </Button>
          </div>
        )}
      </div>
    </div>,
  );
}

function ReviewBlock({ title, editLabel, onEdit, children }) {
  return (
    <div className="border border-gray-200/80 rounded-xl overflow-hidden shadow-xs bg-white">
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50/70 border-b border-gray-100">
        <p className="text-xs font-bold uppercase tracking-wider text-gray-500">
          {title}
        </p>
        <Button
          type="button"
          variant="link"
          onClick={onEdit}
          className="text-xs font-bold uppercase tracking-wider text-[#3C8DBC] hover:text-[#357ca5] h-auto p-0"
        >
          {editLabel}
        </Button>
      </div>
      <div className="px-4 py-2">{children}</div>
    </div>
  );
}

function ReviewRow({ label, value, mono }) {
  return (
    <div className="flex justify-between gap-4 py-2.5 border-b border-gray-100 last:border-b-0">
      <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
        {label}
      </span>
      <span
        className={`${mono ? "font-mono font-bold text-xs" : "font-sans font-medium text-xs"} text-gray-900 text-right`}
      >
        {value}
      </span>
    </div>
  );
}
