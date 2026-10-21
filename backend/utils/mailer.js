import nodemailer from "nodemailer";

const resendApiUrl = "https://api.resend.com";

const isGmail =
  process.env.SMTP_HOST?.includes("gmail") ||
  process.env.SMTP_USER?.endsWith("@gmail.com");

const transporter = nodemailer.createTransport(
  isGmail
    ? {
      service: "gmail",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    }
    : {
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      tls: {
        rejectUnauthorized: false,
      },
    },
);

export async function verifyMailer() {
  if (process.env.RESEND_API_KEY) {
    const response = await fetch(`${resendApiUrl}/domains`, {
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      },
    });
    if (!response.ok) {
      const details = await response.text();
      throw new Error(`Resend verification failed (${response.status}): ${details}`);
    }
    return;
  }

  await transporter.verify();
}

export function getTransporter() {
  return transporter;
}

export function wrap(content) {
  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
</head>
<body style="margin:0;padding:0;background-color:#F4F6F9;font-family:'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F4F6F9;padding:40px 16px;">
  <tr><td align="center">
    <table width="100%" style="max-width:520px;background:#FFFFFF;border-radius:12px;border:1px solid #E2E8F0;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.05);" cellpadding="0" cellspacing="0">
      <!-- Header Banner -->
      <tr>
        <td style="background-color:#1B2A4A;padding:24px 32px;text-align:center;">
          <div style="font-family:'Courier New', Courier, monospace;font-size:11px;font-weight:700;color:#94A3B8;letter-spacing:2px;text-transform:uppercase;margin-bottom:4px;">
            BUTAJIRA COMPETENCY CERTIFICATION
          </div>
          <div style="font-size:18px;font-weight:800;color:#FFFFFF;letter-spacing:1px;text-transform:uppercase;">
            CCMS PORTAL
          </div>
        </td>
      </tr>
      <!-- Main Content -->
      <tr>
        <td style="padding:32px;color:#1E293B;">
          ${content}
        </td>
      </tr>
      <!-- Footer -->
      <tr>
        <td style="background-color:#F8FAFC;padding:20px 32px;border-top:1px solid #E2E8F0;text-align:center;">
          <p style="margin:0;font-size:12px;font-weight:600;color:#64748B;line-height:1.5;">
            Butajira Competency Certification Management System
          </p>
          <p style="margin:4px 0 0;font-size:11px;color:#94A3B8;">
            Automated System Notification &bull; Please do not reply to this email
          </p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

export async function send(to, subject, html, attachments = []) {
  if (process.env.RESEND_API_KEY) {
    const payload = {
      from: process.env.RESEND_FROM || "Butajira CCMS <onboarding@resend.dev>",
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
    };

    if (Array.isArray(attachments) && attachments.length > 0) {
      payload.attachments = attachments.map((att) => ({
        filename: att.filename,
        content: Buffer.isBuffer(att.content) ? att.content.toString("base64") : String(att.content),
      }));
    }

    const response = await fetch(`${resendApiUrl}/emails`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const details = await response.text();
      throw new Error(`Resend email request failed (${response.status}): ${details}`);
    }
    return;
  }

  await transporter.sendMail({
    from: `Butajira CCMS <${process.env.SMTP_USER}>`,
    to,
    subject,
    html,
    attachments,
  });
}

export async function sendTestEmail(to) {
  await send(
    to,
    "CCMS Live Test",
    wrap("<p>Email delivery is working.</p>"),
  );
}

export async function sendPasswordResetEmail(to, resetUrl) {
  await send(
    to,
    "Reset Your Password - Butajira CCMS",
    wrap(`
      <h2 style="margin:0 0 12px;font-size:20px;font-weight:800;color:#0F172A;letter-spacing:-0.3px;">Password Reset Request</h2>
      <p style="font-size:14px;color:#475569;margin:0 0 24px;line-height:1.6;">
        We received a request to reset your password. Click the button below to set a new password. This link expires in <strong>15 minutes</strong>.
      </p>
      <div style="text-align:center;margin:28px 0;">
        <a href="${resetUrl}" style="display:inline-block;padding:14px 32px;background-color:#3C8DBC;color:#FFFFFF;text-decoration:none;font-weight:700;font-size:14px;border-radius:8px;box-shadow:0 2px 8px rgba(60,141,188,0.3);letter-spacing:0.5px;">
          Reset Password &rarr;
        </a>
      </div>
      <p style="font-size:12px;color:#94A3B8;margin:24px 0 0;text-align:center;">
        If you did not request a password reset, your account is safe and you can ignore this email.
      </p>
    `),
  );
}

export async function sendTempPasswordEmail(to, name, tempPassword) {
  await send(
    to,
    "Temporary Password - Butajira CCMS",
    wrap(`
      <h2 style="margin:0 0 12px;font-size:20px;font-weight:800;color:#0F172A;letter-spacing:-0.3px;">Temporary Password</h2>
      <p style="font-size:14px;color:#475569;margin:0 0 8px;">Hello <strong>${name}</strong>,</p>
      <p style="font-size:14px;color:#475569;margin:0 0 24px;line-height:1.6;">
        Your temporary sign-in password has been generated below:
      </p>
      <div style="text-align:center;margin:24px 0;">
        <div style="display:inline-block;font-size:24px;font-weight:800;letter-spacing:6px;color:#FFFFFF;font-family:'Courier New', Courier, monospace;background-color:#1B2A4A;border:1px solid #334155;border-radius:8px;padding:14px 28px;">
          ${tempPassword}
        </div>
      </div>
      <p style="font-size:13px;color:#475569;margin:20px 0 0;font-weight:600;text-align:center;">
        Please sign in and update your password immediately upon login.
      </p>
    `),
  );
}

export async function sendStatusEmail(
  to,
  applicantName,
  status,
  refNumber = null,
  reason = null,
) {
  const messages = {
    staff_rejected: {
      subject: "Application Update - Staff Review",
      title: "Application Requires Action",
      badgeBg: "#FEF2F2",
      badgeColor: "#991B1B",
      body: reason
        ? `Your competency application was reviewed by staff and was not approved.<br/><br/><div style="background:#FEF2F2;border-left:4px solid #EF4444;padding:12px 16px;border-radius:0 6px 6px 0;font-size:13px;color:#7F1D1D;"><strong>Reason for Rejection:</strong> ${reason}</div>`
        : "Your application was reviewed by staff and was not approved at this stage.",
    },
    admin_review: {
      subject: "Application Update - In Admin Review",
      title: "Application Progressing",
      badgeBg: "#EFF6FF",
      badgeColor: "#1E40AF",
      body: "Good news! Your competency application has passed staff review and is now under final administrative review.",
    },
    admin_rejected: {
      subject: "Application Update - Admin Decision",
      title: "Application Not Approved",
      badgeBg: "#FEF2F2",
      badgeColor: "#991B1B",
      body: reason
        ? `Your competency application was reviewed by the admin board and was not approved.<br/><br/><div style="background:#FEF2F2;border-left:4px solid #EF4444;padding:12px 16px;border-radius:0 6px 6px 0;font-size:13px;color:#7F1D1D;"><strong>Reason:</strong> ${reason}</div>`
        : "Your competency application was reviewed by the admin board and was not approved.",
    },
    admin_approved: {
      subject: "Application Approved - Butajira CCMS",
      title: "Application Approved!",
      badgeBg: "#F0FDF4",
      badgeColor: "#166534",
      body: "Congratulations! Your competency application has been approved by the administration. Your certificate is being prepared.",
    },
    certificate_generated: {
      subject: "Your Competency Certificate is Ready",
      title: "Certificate Issued!",
      badgeBg: "#F0FDF4",
      badgeColor: "#166534",
      body: `Your official competency certificate has been issued.<br/><br/><div style="text-align:center;margin:16px 0;"><span style="font-family:'Courier New', Courier, monospace;font-size:16px;font-weight:700;color:#1B2A4A;background:#E2E8F0;padding:8px 16px;border-radius:6px;letter-spacing:1px;">Reference No: ${refNumber}</span></div>`,
    },
  };

  const msg = messages[status];
  if (!msg) return;

  await send(
    to,
    msg.subject,
    wrap(`
      <h2 style="margin:0 0 8px;font-size:20px;font-weight:800;color:#0F172A;">Hello ${applicantName},</h2>
      <div style="display:inline-block;padding:4px 12px;background-color:${msg.badgeBg};color:${msg.badgeColor};font-size:12px;font-weight:700;border-radius:20px;margin-bottom:20px;">
        ${msg.title}
      </div>
      <p style="font-size:14px;color:#334155;margin:0;line-height:1.6;">${msg.body}</p>
    `),
  );
}

export async function sendCertificateEmailNotification({
  to,
  applicantName,
  referenceNumber,
  pdfBuffer,
}) {
  const refSlug = String(referenceNumber || "cert").replace("/", "-");
  await send(
    to,
    "Your Competency Certificate - Butajira CCMS",
    wrap(`
      <h2 style="margin:0 0 8px;font-size:20px;font-weight:800;color:#0F172A;">Hello ${applicantName},</h2>
      <div style="display:inline-block;padding:4px 12px;background-color:#F0FDF4;color:#166534;font-size:12px;font-weight:700;border-radius:20px;margin-bottom:20px;">
        Certificate Issued
      </div>
      <p style="font-size:14px;color:#334155;margin:0 0 12px;line-height:1.6;">
        Your official competency certificate has been issued and is attached to this email.
      </p>
      <div style="text-align:center;margin:20px 0;">
        <span style="font-family:'Courier New', Courier, monospace;font-size:16px;font-weight:700;color:#1B2A4A;background:#E2E8F0;padding:8px 16px;border-radius:6px;letter-spacing:1px;">
          Reference No: ${referenceNumber}
        </span>
      </div>
      <p style="font-size:13px;color:#64748B;margin:16px 0 0;text-align:center;">
        Please find your official PDF certificate attached to this email.
      </p>
    `),
    [
      {
        filename: `certificate-${refSlug}.pdf`,
        content: pdfBuffer,
      },
    ],
  );
}

