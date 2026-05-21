import crypto from "node:crypto";

export const createPasswordResetOtp = () => {
  const rawOtp = `${Math.floor(100000 + Math.random() * 900000)}`;
  const hashedToken = crypto.createHash("sha256").update(rawOtp).digest("hex");

  return {
    expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    hashedToken,
    rawOtp
  };
};

export const createPasswordResetToken = () => {
  const rawToken = crypto.randomBytes(20).toString("hex");
  const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");

  return {
    expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    hashedToken,
    rawToken
  };
};

export const hashPasswordResetToken = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");
