import User from "../models/User.js";
import { verifyToken } from "../utils/token.js";

export const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || "";

    if (!authHeader.startsWith("Bearer ")) {
      res.status(401);
      throw new Error("Authorization token is missing.");
    }

    const token = authHeader.replace("Bearer ", "").trim();
    const decoded = verifyToken(token);
    const user = await User.findById(decoded.userId).select(
      "name email avatarColor avatarUrl about blockedUsers lastSeenAt"
    );

    if (!user) {
      res.status(401);
      throw new Error("User not found.");
    }

    user.lastSeenAt = new Date();
    User.findByIdAndUpdate(user._id, { lastSeenAt: user.lastSeenAt }).catch(() => {});
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};
