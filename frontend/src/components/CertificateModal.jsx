import { useEffect, useRef, useCallback, useState } from "react";
import { createPortal } from "react-dom";
import { X, FileCheck2, Download } from "lucide-react";
import CertificatePreview from "./CertificatePreview.jsx";
import { Button } from "./ui/button.jsx";
import { api } from "../services/api.js";

export default function CertificateModal({ app, onClose, printOnOpen = false }) {
  const printAreaRef = useRef(null);
  const history = app?.certificate?.history || {};
  const years = Object.keys(history).sort((a, b) => Number(b) - Number(a));
  const initialYear = Number(app?.certificate?.latestYear ?? years[0]);
  const [selectedYear, setSelectedYear] = useState(
    Number.isFinite(initialYear) ? initialYear : null,
  );
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState("");

  const handleDownload = useCallback(async () => {
    if (!app?.id) return;
    setDownloading(true);
    setDownloadError("");
    try {
      await api.downloadCertificatePdf(app.id, { year: selectedYear });
    } catch (err) {
      setDownloadError(
        err?.message || "Could not download the certificate PDF.",
      );
    } finally {
      setDownloading(false);
    }
  }, [app, selectedYear]);

  const doPrint = useCallback(() => {
    const el = printAreaRef.current;
    if (!el) return;


    const styleLinks = Array.from(document.querySelectorAll("link[rel='stylesheet']"))
      .map((l) => `<link rel="stylesheet" href="${l.href}">`)
      .join("\n");

    const iframe = document.createElement("iframe");
    iframe.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:794px;height:1123px;border:none;";
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open();
    doc.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  ${styleLinks}
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 8mm; background: white; }
    @page { size: A4 portrait; margin: 8mm; }
  </style>
</head>
<body>${el.innerHTML}</body>
</html>`);
    doc.close();

    iframe.contentWindow.focus();

    iframe.onload = () => {
      iframe.contentWindow.print();
      setTimeout(() => document.body.removeChild(iframe), 1000);
    };

    setTimeout(() => {
      if (document.body.contains(iframe)) {
        iframe.contentWindow.print();
        setTimeout(() => {
          if (document.body.contains(iframe)) document.body.removeChild(iframe);
        }, 1000);
      }
    }, 800);
  }, []);

  useEffect(() => {
    if (printOnOpen) {
      const t = setTimeout(doPrint, 500);
      return () => clearTimeout(t);
    }
  }, [printOnOpen, doPrint]);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#1e1f22]/95 backdrop-blur-sm p-4 sm:p-8"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-full max-w-[860px] my-6">

        <div className="flex items-center justify-between mb-4 bg-[#2b2d31] border border-[#1e1f22] rounded-lg px-5 py-3.5 shadow-lg">
          <div className="flex items-center gap-2.5">
            <FileCheck2 size={17} className="text-[#5865f2]" />
            <div className="leading-tight">
              <p className="font-mono text-[9px] tracking-[0.16em] uppercase text-[#949ba4]">Certificate</p>
              <p className="font-mono text-[13px] text-white">{app.certificate.referenceNumber}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">

            {years.length > 1 && (
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-[#949ba4]">Version</span>
                <div className="flex gap-1">
                  {years.map((y) => (
                    <button
                      key={y}
                      onClick={() => setSelectedYear(Number(y))}
                      className={`font-mono text-[10px] px-2.5 py-1 rounded border transition-colors ${
                        String(selectedYear) === String(y)
                          ? "bg-[#5865f2] text-white border-[#5865f2]"
                          : "bg-transparent text-[#949ba4] border-[#3f4147] hover:border-[#5865f2] hover:text-white"
                      }`}
                    >
                      {y}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <Button
              onClick={handleDownload}
              disabled={downloading}
              variant="ghost"
              size="sm"
              className="font-mono text-[11px] uppercase tracking-[0.1em] text-[#949ba4] hover:text-white hover:bg-paper-card/10"
            >
              <Download size={15} className="mr-1.5" />
              {downloading ? "Downloading…" : "Download PDF"}
            </Button>
            <Button
              onClick={onClose}
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full text-[#949ba4] hover:text-white hover:bg-paper-card/10"
              aria-label="Close"
            >
              <X size={18} />
            </Button>
          </div>
        </div>

        {downloadError && (
          <p className="mb-3 text-xs font-semibold text-rose-300" role="alert">
            {downloadError}
          </p>
        )}

        <div className="bg-[#2b2d31] border border-[#1e1f22] rounded-lg p-6 sm:p-10 shadow-2xl">
          <div ref={printAreaRef}>
            <CertificatePreview app={app} selectedYear={selectedYear} />
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
