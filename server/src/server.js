import dotenv from "dotenv";
import http from "http";

import { Server } from "socket.io";

import app from "./app.js";
import { connectDB } from "./config/db.js";
import User from "./models/User.js";
import { verifyToken } from "./utils/token.js";

dotenv.config();

const port = Number(process.env.PORT) || 5000;
const server = http.createServer(app);

const allowedOrigins = (process.env.CLIENT_URL || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const io = new Server(server, {
  cors: {
    credentials: true,
    origin: allowedOrigins
  }
});

const onlineUsers = new Map();
const socketCounts = new Map();

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;

    if (!token) {
      next(new Error("Unauthorized"));
      return;
    }

    const decoded = verifyToken(token);
    const user = await User.findById(decoded.userId).select(
      "name email avatarColor avatarUrl about blockedUsers lastSeenAt"
    );

    if (!user) {
      next(new Error("Unauthorized"));
      return;
    }

    socket.user = user;
    next();
  } catch (error) {
    next(new Error("Unauthorized"));
  }
});

io.on("connection", (socket) => {
  const userId = socket.user._id.toString();
  socket.join(userId);

  const activeCount = (socketCounts.get(userId) || 0) + 1;
  socketCounts.set(userId, activeCount);
  onlineUsers.set(userId, true);

  User.findByIdAndUpdate(userId, { lastSeenAt: new Date() }).catch(() => {});

  socket.emit("presence:list", { userIds: [...onlineUsers.keys()] });
  io.emit("presence:update", { isOnline: true, lastSeenAt: new Date().toISOString(), userId });

  socket.on("call:offer", ({ callType, conversationId, sdp, toUserId }) => {
    io.to(toUserId).emit("call:offer", {
      callType,
      conversationId,
      fromUser: {
        _id: userId,
        avatarUrl: socket.user.avatarUrl || "",
        name: socket.user.name
      },
      sdp
    });
  });

  socket.on("call:answer", ({ sdp, toUserId }) => {
    io.to(toUserId).emit("call:answer", {
      fromUserId: userId,
      sdp
    });
  });

  socket.on("call:ice-candidate", ({ candidate, toUserId }) => {
    io.to(toUserId).emit("call:ice-candidate", {
      candidate,
      fromUserId: userId
    });
  });

  socket.on("call:decline", ({ reason, toUserId }) => {
    io.to(toUserId).emit("call:decline", {
      fromUserId: userId,
      reason: reason || "declined"
    });
  });

  socket.on("call:end", ({ toUserId }) => {
    io.to(toUserId).emit("call:end", {
      fromUserId: userId
    });
  });

  socket.on("disconnect", () => {
    const remainingCount = Math.max((socketCounts.get(userId) || 1) - 1, 0);

    if (remainingCount === 0) {
      const lastSeenAt = new Date();
      socketCounts.delete(userId);
      onlineUsers.delete(userId);
      User.findByIdAndUpdate(userId, { lastSeenAt }).catch(() => {});
      io.emit("presence:update", { isOnline: false, lastSeenAt: lastSeenAt.toISOString(), userId });
      return;
    }

    socketCounts.set(userId, remainingCount);
  });
});

app.set("io", io);
app.set("onlineUsers", onlineUsers);

connectDB()
  .then(() => {
    server.listen(port, () => {
      console.log(`Server running on http://localhost:${port}`);
    });
  })
  .catch((error) => {
    console.error("Server boot failed", error.message);
    process.exit(1);
  });
