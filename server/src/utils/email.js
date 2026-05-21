import nodemailer from "nodemailer";

const toBoolean = (value) => `${value}`.trim().toLowerCase() === "true";

const getTransportConfig = () => {
  const { SMTP_HOST, SMTP_PASS, SMTP_PORT, SMTP_SECURE, SMTP_SERVICE, SMTP_USER } = process.env;

  if (SMTP_SERVICE && SMTP_USER && SMTP_PASS) {
    return {
      auth: {
        pass: SMTP_PASS,
        user: SMTP_USER
      },
      service: SMTP_SERVICE
    };
  }

  if (SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS) {
    return {
      auth: {
        pass: SMTP_PASS,
        user: SMTP_USER
      },
      host: SMTP_HOST,
      port: Number(SMTP_PORT),
      secure: toBoolean(SMTP_SECURE) || Number(SMTP_PORT) === 465
    };
  }

  return null;
};

export const isEmailConfigured = () => Boolean(getTransportConfig() && process.env.MAIL_FROM);

export const sendPasswordResetOtpEmail = async ({ otp, recipientEmail, recipientName }) => {
  const transportConfig = getTransportConfig();

  if (!transportConfig || !process.env.MAIL_FROM) {
    throw new Error("Email OTP is not configured on the server.");
  }

  const transporter = nodemailer.createTransport(transportConfig);
  const safeName = recipientName?.trim() || "there";

  await transporter.sendMail({
    from: process.env.MAIL_FROM,
    html: `
      <div style="background:#0b141a;padding:32px 16px;font-family:Arial,sans-serif;color:#f5f7f8">
        <div style="max-width:480px;margin:0 auto;background:#111b21;border-radius:24px;padding:24px">
          <h1 style="margin:0 0 12px;font-size:24px">PulseChat</h1>
          <p style="margin:0 0 16px;color:#c8d5db">Hi ${safeName},</p>
          <p style="margin:0 0 16px;color:#c8d5db">Use this OTP to reset your password:</p>
          <div style="font-size:32px;font-weight:700;letter-spacing:8px;margin:0 0 18px;color:#25d366">${otp}</div>
          <p style="margin:0 0 10px;color:#c8d5db">This OTP expires in 15 minutes.</p>
          <p style="margin:0;color:#8ea3ac">If you did not request this, you can safely ignore this email.</p>
        </div>
      </div>
    `,
    subject: "PulseChat password reset OTP",
    text: `Hi ${safeName}, your PulseChat password reset OTP is ${otp}. It expires in 15 minutes.`,
    to: recipientEmail
  });
};
