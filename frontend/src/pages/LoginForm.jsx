import { useState, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { Eye, EyeOff, AlertCircle, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";
import LanguageToggle from "../components/LanguageToggle.jsx";
import { useLanguage } from "@/hooks/useLanguage.js";
import { useAuth } from "@/hooks/useAuth.js";

const HOME_BY_ROLE = {
  applicant: "/applicant/dashboard",
  staff: "/staff/dashboard/overview",
  admin: "/admin/dashboard/overview",
};

const containerVariants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.15, duration: 0.4 },
  },
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 350, damping: 26 } },
};

export default function LoginForm() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { login } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState(location.state?.email || "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState(location.state?.message || "");
  const [submitting, setSubmitting] = useState(false);

  async function submitLogin(identifier, secret) {
    setError("");
    setSuccessMsg("");
    const val = identifier.trim();
    if (!val || !secret) { setError(t("errorRequiredLogin")); return; }
    if (val.includes("@") && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) { setError(t("errorEmail")); return; }
    setSubmitting(true);
    try {
      const user = await login(val, secret);
      navigate(HOME_BY_ROLE[user.role] || "/applicant/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    await submitLogin(email, password);
  }

  return (
    <div className="min-h-screen w-full flex text-gray-900 overflow-hidden font-sans relative bg-[#F4F5F7]">
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="hidden lg:flex lg:w-[45%] xl:w-1/2 relative flex-col justify-between p-12 text-white bg-[#1B2A4A] border-r border-slate-700/80 shrink-0 z-10"
      >
        <div className="relative z-20 flex items-center gap-3">
          <img src="/logo2.png" alt="Company Logo" className="h-14 sm:h-16 w-auto object-contain shrink-0 drop-shadow-md" />
          <span className="text-base sm:text-lg font-bold tracking-wider text-slate-200 uppercase font-mono">CCMS Portal</span>
        </div>

        <div className="relative z-20 max-w-md mx-auto my-auto text-center flex flex-col items-center justify-center py-12">
          <h2 className="text-3xl sm:text-4xl font-extrabold mb-4 leading-tight tracking-tight text-white font-sans text-center">
            {t("auth_loginLeftTitle")}
          </h2>
          <p className="text-slate-300 text-base leading-relaxed font-normal text-center">
            {t("auth_loginLeftDesc")}
          </p>
        </div>

        <div className="relative z-20 text-slate-400 text-xs font-mono text-center lg:text-left">
          {t("auth_footer", { year: new Date().getFullYear() })}
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="flex-1 flex flex-col items-center justify-center relative px-4 sm:px-8 lg:px-16 pt-16 pb-12 overflow-y-auto w-full"
      >
        <div className="absolute top-4 right-4 sm:top-6 sm:right-6 lg:right-10 z-20">
          <LanguageToggle light />
        </div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="w-full max-w-[440px] relative z-10 my-auto"
        >
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xl p-6 sm:p-10">
            <motion.div variants={itemVariants} className="mb-6 text-center">
              <div className="flex items-center justify-center gap-3 mb-1.5">
                <img src="/logo2.png" alt="Company Logo" className="h-9 sm:h-10 w-auto object-contain shrink-0" />
                <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
                  {t("auth_welcome")}
                </h1>
              </div>
              <p className="text-xs text-gray-500 font-medium">Enter your credentials to access your portal</p>
            </motion.div>

            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              <motion.div variants={itemVariants} className="space-y-1.5">
                <label className="block text-gray-700 text-xs font-semibold uppercase tracking-wider">
                  Email or Username
                </label>
                <input
                  type="text"
                  name="email"
                  id="login-email"
                  autoComplete="username"
                  spellCheck={false}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-11 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3C8DBC] focus:bg-white px-3.5 text-sm text-gray-900 transition-all"
                  placeholder="Email or Username"
                />
              </motion.div>

              <motion.div variants={itemVariants} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-gray-700 text-xs font-semibold uppercase tracking-wider">
                    Password
                  </label>
                  <a
                    href="/forgot-password"
                    className="text-xs text-[#3C8DBC] hover:underline font-semibold"
                  >
                    Forgot password?
                  </a>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    autoComplete="current-password"
                    spellCheck={false}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full h-11 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3C8DBC] focus:bg-white pl-3.5 pr-10 text-sm text-gray-900 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </motion.div>

              {successMsg && (
                <motion.div variants={itemVariants} className="flex items-start gap-2.5 p-3.5 bg-emerald-50 border-l-4 border-emerald-600 rounded-r-xl text-emerald-800 text-xs font-semibold shadow-2xs">
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                  <span className="leading-snug flex-1">{successMsg}</span>
                </motion.div>
              )}

              {error && (
                <motion.div variants={itemVariants} className="flex items-start gap-2.5 p-3.5 bg-rose-50 border-l-4 border-rose-600 rounded-r-xl text-rose-800 text-xs font-semibold shadow-2xs">
                  <AlertCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
                  <span className="leading-snug flex-1">{error}</span>
                </motion.div>
              )}

              <motion.div variants={itemVariants} className="pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full h-11 bg-[#3C8DBC] hover:bg-[#357ca5] text-white font-bold text-sm rounded-lg transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center cursor-pointer"
                >
                  {submitting ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <span>Sign In</span>
                  )}
                </button>
              </motion.div>
            </form>

            <motion.div variants={itemVariants} className="mt-6 border-t border-gray-100 pt-4 text-center">
              <p className="text-gray-500 text-xs font-medium">
                Need an account?{" "}
                <Link to="/auth/register" className="text-[#3C8DBC] font-semibold hover:underline">
                  Create Account
                </Link>
              </p>
            </motion.div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
