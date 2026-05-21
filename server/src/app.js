import cors from "cors";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  changePassword,
  forgotPassword,
  getCurrentUser,
  loginUser,
  registerUser,
  resetPassword
} from "./controllers/authController.js";
import {
  addGroupMembers,
  createGroupConversation,
  deleteConversation,
  deleteMessage,
  getDirectConversation,
  getMessages,
  listConversations,
  removeGroupMember,
  sendMessage,
  updateGroupConversation
} from "./controllers/chatController.js";
import { createStory, listStories, markStoryViewed } from "./controllers/storyController.js";
import {
  blockUser,
  listBlockedUsers,
  listUsers,
  unblockUser,
  updateProfile,
  uploadAvatarPicture
} from "./controllers/userController.js";
import { protect } from "./middleware/auth.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";
import { uploadAvatar, uploadMessageAttachment, uploadStoryMedia } from "./middleware/upload.js";

const app = express();
const currentDir = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(currentDir, "..", "uploads");

const allowedOrigins = (process.env.CLIENT_URL || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    credentials: true,
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Origin not allowed by CORS"));
    }
  })
);

app.use(express.json({ limit: "1mb" }));
app.use("/uploads", express.static(uploadsDir));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.post("/api/auth/register", registerUser);
app.post("/api/auth/login", loginUser);
app.post("/api/auth/forgot-password", forgotPassword);
app.post("/api/auth/reset-password", resetPassword);
app.get("/api/auth/me", protect, getCurrentUser);
app.post("/api/auth/change-password", protect, changePassword);

app.get("/api/users", protect, listUsers);
app.get("/api/users/blocked", protect, listBlockedUsers);
app.patch("/api/users/me", protect, updateProfile);
app.post("/api/users/me/avatar", protect, uploadAvatar.single("avatar"), uploadAvatarPicture);
app.post("/api/users/:userId/block", protect, blockUser);
app.delete("/api/users/:userId/block", protect, unblockUser);

app.get("/api/chats", protect, listConversations);
app.post("/api/chats/group", protect, createGroupConversation);
app.post("/api/chats/direct/:userId", protect, getDirectConversation);
app.delete("/api/chats/:conversationId", protect, deleteConversation);
app.patch("/api/chats/:conversationId/group", protect, updateGroupConversation);
app.post("/api/chats/:conversationId/group/members", protect, addGroupMembers);
app.delete("/api/chats/:conversationId/group/members/:userId", protect, removeGroupMember);
app.get("/api/chats/:conversationId/messages", protect, getMessages);
app.post(
  "/api/chats/:conversationId/messages",
  protect,
  uploadMessageAttachment.single("attachment"),
  sendMessage
);
app.delete("/api/chats/:conversationId/messages/:messageId", protect, deleteMessage);

app.get("/api/stories", protect, listStories);
app.post("/api/stories", protect, uploadStoryMedia.single("storyMedia"), createStory);
app.post("/api/stories/:storyId/view", protect, markStoryViewed);

app.use(notFound);
app.use(errorHandler);

export default app;
