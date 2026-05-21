import bcrypt from "bcryptjs";

import User from "../models/User.js";
import { getAvatarColor } from "../utils/avatarColor.js";
import { isEmailConfigured, sendPasswordResetOtpEmail } from "../utils/email.js";
import { createPasswordResetOtp, hashPasswordResetToken } from "../utils/passwordReset.js";
import { serializeUser } from "../utils/serializers.js";
import { generateToken } from "../utils/token.js";

const buildAuthResponse = (user) => ({
  token: generateToken(user._id.toString()),
  user: serializeUser(user, { viewer: user })
});

export const registerUser = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      res.status(400);
      throw new Error("Name, email, and password are required.");
    }

    if (password.length < 6) {
      res.status(400);
      throw new Error("Password must be at least 6 characters.");
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existingUser = await User.findOne({ email: normalizedEmail });

    if (existingUser) {
      res.status(409);
      throw new Error("An account already exists with that email.");
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      avatarColor: getAvatarColor(name)
    });

    res.status(201).json(buildAuthResponse(user));
  } catch (error) {
    next(error);
  }
};

export const loginUser = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400);
      throw new Error("Email and password are required.");
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail }).select("+password");

    if (!user) {
      res.status(401);
      throw new Error("Invalid email or password.");
    }

    const matches = await bcrypt.compare(password, user.password);

    if (!matches) {
      res.status(401);
      throw new Error("Invalid email or password.");
    }

    res.json(buildAuthResponse(user));
  } catch (error) {
    next(error);
  }
};

export const getCurrentUser = async (req, res) => {
  res.json({ user: serializeUser(req.user, { viewer: req.user }) });
};

export const forgotPassword = async (req, res, next) => {
  try {
    const email = req.body?.email?.trim()?.toLowerCase();

    if (!email) {
      res.status(400);
      throw new Error("Email is required.");
    }

    if (!isEmailConfigured()) {
      res.status(503);
      throw new Error("Email OTP is not configured yet. Add SMTP settings on the server first.");
    }

    const user = await User.findOne({ email });

    if (!user) {
      res.json({
        message: "If that email exists, an OTP has been sent."
      });
      return;
    }

    const reset = createPasswordResetOtp();

    user.resetPasswordToken = reset.hashedToken;
    user.resetPasswordExpiresAt = reset.expiresAt;
    await user.save();

    try {
      await sendPasswordResetOtpEmail({
        otp: reset.rawOtp,
        recipientEmail: user.email,
        recipientName: user.name
      });
    } catch (emailError) {
      user.resetPasswordToken = "";
      user.resetPasswordExpiresAt = null;
      await user.save();
      throw emailError;
    }

    res.json({
      expiresAt: reset.expiresAt,
      message: "OTP sent to your email address."
    });
  } catch (error) {
    next(error);
  }
};

export const resetPassword = async (req, res, next) => {
  try {
    const email = req.body?.email?.trim()?.toLowerCase();
    const otp = req.body?.otp?.trim?.() || req.body?.token?.trim?.();
    const password = req.body?.password;

    if (!email || !otp || !password) {
      res.status(400);
      throw new Error("Email, OTP, and new password are required.");
    }

    if (password.length < 6) {
      res.status(400);
      throw new Error("Password must be at least 6 characters.");
    }

    const hashedToken = hashPasswordResetToken(otp);
    const user = await User.findOne({
      email,
      resetPasswordExpiresAt: { $gt: new Date() },
      resetPasswordToken: hashedToken
    }).select("+password");

    if (!user) {
      res.status(400);
      throw new Error("OTP is invalid or expired.");
    }

    user.password = await bcrypt.hash(password, 10);
    user.resetPasswordToken = "";
    user.resetPasswordExpiresAt = null;
    await user.save();

    res.json({
      message: "Password reset successful. Please sign in with the new password."
    });
  } catch (error) {
    next(error);
  }
};

export const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      res.status(400);
      throw new Error("Current password and new password are required.");
    }

    if (newPassword.length < 6) {
      res.status(400);
      throw new Error("New password must be at least 6 characters.");
    }

    const user = await User.findById(req.user._id).select("+password");

    if (!user) {
      res.status(404);
      throw new Error("User not found.");
    }

    const matches = await bcrypt.compare(currentPassword, user.password);

    if (!matches) {
      res.status(401);
      throw new Error("Current password is incorrect.");
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.json({
      message: "Password updated successfully."
    });
  } catch (error) {
    next(error);
  }
};
