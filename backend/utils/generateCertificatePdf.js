import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import QRCode from "qrcode";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.join(__dirname, "../uploads");
const PUBLIC_DIR = path.join(__dirname, "../../frontend/public");

function toEthNumeric(date) {
  const d = date instanceof Date ? date : new Date(date);
  const y = d.getFullYear(), m = d.getMonth() + 1, day = d.getDate();
  const a = Math.floor((14 - m) / 12);
  const yr = y + 4800 - a;
  const mo = m + 12 * a - 3;
  const jdn = day + Math.floor((153 * mo + 2) / 5) + 365 * yr +
    Math.floor(yr / 4) - Math.floor(yr / 100) + Math.floor(yr / 400) - 32045;
  const r = (jdn - 1723856) % 1461;
  const n = (r % 365) + 365 * Math.floor(r / 1460);
  const eyear = 4 * Math.floor((jdn - 1723856) / 1461) + Math.floor(r / 365) - Math.floor(r / 1460);
  const emonth = Math.floor(n / 30) + 1;
  const eday = (n % 30) + 1;
  return `${String(eday).padStart(2, "0")}/${String(emonth).padStart(2, "0")}/${String(eyear).slice(-2)}`;
}

async function urlToBase64(src) {
  try {
    if (!src) return null;
    if (src.startsWith("data:")) return src;
    if (fs.existsSync(src)) {
      const ext = path.extname(src).slice(1).toLowerCase();
      const mime = ext === "png" ? "image/png" : "image/jpeg";
      return `data:${mime};base64,${fs.readFileSync(src).toString("base64")}`;
    }
    return null;
  } catch {
    return null;
  }
}

function resolvePuppeteerExecutablePath() {
  const explicitPath = process.env.PUPPETEER_EXECUTABLE_PATH;
  if (explicitPath && fs.existsSync(explicitPath)) {
    return explicitPath;
  }

  try {
    const defaultPath = puppeteer.executablePath();
    if (defaultPath && fs.existsSync(defaultPath)) {
      return defaultPath;
    }
  } catch {}

  const homeDir = process.env.HOME || process.env.USERPROFILE || "";
  const cacheRoots = [
    path.join(__dirname, "../.cache/puppeteer"),
    path.join(__dirname, "../../.cache/puppeteer"),
    path.join(homeDir, ".cache", "puppeteer"),
    "/opt/render/.cache/puppeteer",
  ];
  const isWin = process.platform === "win32";

  const browserCandidates = [
    {
      folder: "chrome-headless-shell",
      binaryFolder: isWin ? "chrome-headless-shell-win64" : "chrome-headless-shell-linux64",
      binaryName: isWin ? "chrome-headless-shell.exe" : "chrome-headless-shell",
    },
    {
      folder: "chrome",
      binaryFolder: isWin ? "chrome-win64" : "chrome-linux64",
      binaryName: isWin ? "chrome.exe" : "chrome",
    },
  ];

  for (const cacheRoot of cacheRoots) {
    if (!fs.existsSync(cacheRoot)) continue;
    for (const candidate of browserCandidates) {
      const browserRoot = path.join(cacheRoot, candidate.folder);
      if (!fs.existsSync(browserRoot)) continue;

      const browserVersions = fs.readdirSync(browserRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory());
      for (const versionEntry of browserVersions) {
        const executablePath = path.join(browserRoot, versionEntry.name, candidate.binaryFolder, candidate.binaryName);
        if (fs.existsSync(executablePath)) {
          return executablePath;
        }
      }
    }
  }

  const systemPaths = [
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
  ];
  for (const sysPath of systemPaths) {
    if (fs.existsSync(sysPath)) return sysPath;
  }

  return null;
}

export async function generateCertificatePdf(app, year) {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
  const filename = `cert-${app.appId}-${year}.pdf`;
  const fullPath = path.join(UPLOADS_DIR, filename);

  const info = app.applicantInfo;
  const addr = info.address || {};
  const cert = app.certificate;
  const licenseeName = app.hasTradeLicense ? app.businessName || info.fullName : info.fullName;

  const histObj = cert.history?.toObject ? cert.history.toObject() : cert.history || {};
  const yearEntry = histObj[String(year)] || {};
  const issuedAt = yearEntry.issuedAt || cert.issuedAt;

  const [seq] = String(cert.referenceNumber).split("/");
  const baseUrl = (process.env.CLIENT_ORIGIN || "http://localhost:5173").replace(/\/$/, "");
  const verifyUrl = `${baseUrl}/verify/${year}/${seq}`;

  const qrDataUrl = await QRCode.toDataURL(verifyUrl, { width: 64, margin: 1 });
  const logoPath = fs.existsSync(path.join(PUBLIC_DIR, "logo2.png"))
    ? path.join(PUBLIC_DIR, "logo2.png")
    : path.join(PUBLIC_DIR, "logo.png");
  const logoB64 = await urlToBase64(logoPath);
  const photoSrc = app.documents?.photo?.path || null;
  const photoAbsPath = photoSrc?.startsWith("/uploads/")
    ? path.join(__dirname, "../uploads", path.basename(photoSrc))
    : photoSrc;
  const photoB64 = await urlToBase64(photoAbsPath);

  const sectorLabel =
    (app.serviceType?.nameAm || app.serviceType?.name || "-") +
    (app.serviceType?.code ? ` (${app.serviceType.code})` : "");

  const isRenewal = app.applicationType === "renewal";

  function row(amLabel, enLabel, value, indent = "0") {
    return `
      <div style="margin:3px 0 3px ${indent}px">
        <div style="display:flex;align-items:baseline;gap:4px">
          <span style="font-weight:600;white-space:nowrap">${amLabel}:</span>
          <span style="flex:1;border-bottom:1.5px dashed #555;text-align:center;min-width:60px">${value || "-"}</span>
        </div>
        <div style="font-size:10px;color:#777;margin-left:4px">${enLabel}</div>
      </div>`;
  }

  function numberedRow(num, amLabel, enLabel, value) {
    return `
      <div style="margin:3px 0">
        <div style="display:flex;align-items:baseline;gap:4px">
          <span style="font-weight:600;white-space:nowrap">${num}</span>
          <span style="font-weight:600;white-space:nowrap">${amLabel}:</span>
          <span style="flex:1;border-bottom:1.5px dashed #555;text-align:center;min-width:60px">${value || "-"}</span>
        </div>
        <div style="font-size:10px;color:#777;margin-left:4px">${enLabel}</div>
      </div>`;
  }

  function bulletRow(amLabel, enLabel, value) {
    return `
      <div style="margin:3px 0 3px 28px">
        <div style="display:flex;align-items:baseline;gap:4px">
          <span style="color:#555">•</span>
          <span style="font-weight:600;white-space:nowrap">${amLabel}:</span>
          <span style="flex:1;border-bottom:1.5px dashed #555;text-align:center;min-width:60px">${value || "-"}</span>
        </div>
        <div style="font-size:10px;color:#777;margin-left:16px">${enLabel}</div>
      </div>`;
  }

  const fullAddressStr = addr.licenseOwnerAddress || [addr.region, addr.woreda, addr.kebele].filter(Boolean).map(s => String(s).trim()).join("/") || "-";

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: serif; font-size: 13px; color: #000; background: white; }
  @page { size: A4 portrait; margin: 0; }
</style>
</head>
<body>
<div style="border:4px solid #0e7490;width:794px;min-height:1120px;margin:0 auto;background:white;padding:0">
  <div style="display:flex;align-items:flex-end;justify-content:space-between;gap:8px;padding:8px 20px 12px">
    <div style="flex:1;text-align:left;font-size:12px;line-height:1.5">
      <div>በኢትዮጵያ ፌዴራላዊ ዲሞክራሲያዊ ሪፐብሊክ</div>
      <div>የመገናኛና እንፎርሜሽን ቴክኖሎጅ ሚኒስቴር</div>
    </div>
    <div style="flex-shrink:0">
      ${logoB64 ? `<img src="${logoB64}" style="width:80px;height:80px;object-fit:contain"/>` : ""}
    </div>
    <div style="flex:1;text-align:right;font-size:12px;line-height:1.5">
      <div>The Federal Democratic Republic of Ethiopia</div>
      <div>Ministry of Communication &amp; Information Technology</div>
    </div>
  </div>
  <hr style="border:none;border-top:1px solid #9ca3af;margin:0 24px"/>
  <div style="display:flex;justify-content:center;margin:14px 0">
    <div style="border-bottom:1.5px dashed #6b7280;text-align:center;width:600px;padding-bottom:4px;font-size:14px">
      ${sectorLabel}
    </div>
  </div>
  <div style="display:flex;gap:24px;padding:8px 12px;align-items:flex-start">
    <div style="flex-shrink:0;margin-left:7.5%">
      <div style="width:144px;height:176px;border:2px solid #374151;overflow:hidden;display:flex;align-items:center;justify-content:center;background:#f9fafb">
        ${photoB64 ? `<img src="${photoB64}" style="width:100%;height:100%;object-fit:cover"/>` : `<span style="font-size:11px;color:#9ca3af">Photo</span>`}
      </div>
    </div>
    <div style="margin-left:auto;width:55%;font-size:13px">
      ${row("የግብር ከፋይ መለያ ቁጥር", "TIN", app.tin || "-")}
      ${row("የብቃት ማረጋገጫ ቁጥር", "Competency No.", app.serviceType?.code || "-")}
      ${row("ፈቃድ የተሰጠበት ቀን", "Date of Issuance", toEthNumeric(issuedAt))}
      ${row("ቁጥር፡-ደኢ/መ/ኤ/ቴ/ኤ/", "Reference", cert.referenceNumber)}
    </div>
  </div>
  <div style="margin:12px auto;width:85%;font-size:13px">
    ${numberedRow("1.", "የባለ ፈቃዱ ስም", "Name of the License", licenseeName)}
    ${numberedRow("2.", "የአመልካች አድራሻ", "Applicant Address", fullAddressStr)}
    ${bulletRow("ክልል", "Region", addr.region || "-")}
    ${bulletRow("ወረዳ", "Woreda", addr.woreda || "-")}
    ${bulletRow("ቀበሌ", "Kebele", addr.kebele || "-")}
    ${bulletRow("ሰልክ ቁጥር", "Telephone", info.phone || "-")}
    ${bulletRow("ፖ.ሣ.ቁ", "P.O.Box", addr.poBox || "-")}
    ${bulletRow("ፋክስ", "Fax", addr.fax || "-")}
    ${bulletRow("ኢ-ሜይል", "E-mail", addr.email || "-")}
    <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-top:8px">
      <div style="margin-left:28px;display:flex;align-items:flex-end;gap:4px;font-size:13px">
        <span>ለ</span>
        <div style="display:flex;flex-direction:column;align-items:center">
          <span style="min-width:48px;text-align:center">${year}</span>
          <span style="border-top:1.5px dashed #555;width:64px;display:block"></span>
        </div>
        <span>${isRenewal ? "ዓ.ም ታድሷል" : "ዓ.ም"}</span>
      </div>
      <div style="text-align:center">
        <span style="display:inline-block;width:144px;border-bottom:1.5px dashed #555"></span>
        <div style="font-size:12px;margin-top:2px">የኃላፊው ስምና ፊርማ</div>
        <div style="font-size:10px;color:#6b7280">Official Name and Signature</div>
      </div>
    </div>
  </div>
  <div style="margin:12px 16px 24px;padding:12px 16px;background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;display:flex;align-items:center;justify-content:space-between;gap:12px">
    <div style="flex:1;font-size:10px;color:#334155;line-height:1.5">
      <p style="margin-bottom:4px;font-weight:600;color:#0f172a">ይህ ፈቃድ በቴሌኮሙኒኬሽን አዋጅ ቁጥር 49/1889 (እንደተሸሻለው) አንቀጽ 10 ንዑስ አንቀጽ 4 መሠረት በወጣው የቴሌኮሙኒኬሽን ሪሴል አገልግሎት እና የቴሌ ሴንተር ፈቃድ መመሪያ ቁጥር 1/1995 መሠረት የተሰጠ፡፡</p>
      <p style="color:#64748b;font-size:9px">This license is issued as per the Directive on resale and Telecenter in Telecommunication No1/2002 that is issued on the basis of Article 10 sub-Article 4 of Telecommunication Proclamation No 49/1996 (as amended).</p>
    </div>
    <div style="flex-shrink:0;background:#ffffff;padding:4px;border:1px solid #e2e8f0;border-radius:6px">
      <img src="${qrDataUrl}" style="width:60px;height:60px"/>
    </div>
  </div>
</div>
</body>
</html>`;

  const executablePath = resolvePuppeteerExecutablePath();
  const browser = await puppeteer.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    ...(executablePath ? { executablePath } : {}),
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: "load" });
    await page.pdf({
      path: fullPath,
      width: "794px",
      height: "1123px",
      printBackground: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });
  } finally {
    await browser.close();
  }


  return `/uploads/${filename}`;
}
