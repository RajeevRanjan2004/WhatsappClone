import User from "../models/User.js";
import { storeUploadedFile } from "../middleware/upload.js";
import { getAvatarColor } from "../utils/avatarColor.js";
import { removeUploadFile } from "../utils/files.js";
import { serializeUser } from "../utils/serializers.js";

const publicUserFields = "name email avatarColor avatarUrl about blockedUsers lastSeenAt";
const editableUserFields = `${publicUserFields} avatarStorageKey`;
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const serializeForViewer = (user, req) =>
  serializeUser(user, {
    onlineUsers: req.app.get("onlineUsers"),
    viewer: req.user
  });

const loadBlockedUsers = async (userIdList) => {
  if (!userIdList?.length) {
    return [];
  }

  return User.find({ _id: { $in: userIdList } })
    .select(publicUserFields)
    .sort({ name: 1 });
};

export const listUsers = async (req, res, next) => {
  try {
    const search = req.query.search?.trim() || "";
    const query = {
      _id: { $ne: req.user._id }
    };

    if (search) {
      const safeSearch = new RegExp(escapeRegex(search), "i");
      query.$or = [{ name: safeSearch }, { email: safeSearch }];
    }

    const users = await User.find(query).select(publicUserFields).sort({ name: 1 });
    res.json(users.map((user) => serializeForViewer(user, req)));
  } catch (error) {
    next(error);
  }
};

export const listBlockedUsers = async (req, res, next) => {
  try {
    const blockedUsers = await loadBlockedUsers(req.user.blockedUsers);
    res.json(blockedUsers.map((user) => serializeForViewer(user, req)));
  } catch (error) {
    next(error);
  }
};

export const updateProfile = async (req, res, next) => {
  try {
    const { about, name } = req.body;
    const user = await User.findById(req.user._id).select(editableUserFields);

    if (!user) {
      res.status(404);
      throw new Error("User not found.");
    }

    if (name !== undefined) {
      const nextName = name.trim();

      if (nextName.length < 2 || nextName.length > 50) {
        res.status(400);
        throw new Error("Name must be between 2 and 50 characters.");
      }

      user.name = nextName;

      if (!user.avatarUrl) {
        user.avatarColor = getAvatarColor(nextName);
      }
    }

    if (about !== undefined) {
      user.about = about.trim().slice(0, 140) || "Available";
    }

    await user.save();
    res.json({ user: serializeForViewer(user, req) });
  } catch (error) {
    next(error);
  }
};

export const uploadAvatarPicture = async (req, res, next) => {
  try {
    if (!req.file) {
      res.status(400);
      throw new Error("Choose an avatar image first.");
    }

    const user = await User.findById(req.user._id).select(editableUserFields);

    if (!user) {
      res.status(404);
      throw new Error("User not found.");
    }

    if (user.avatarUrl) {
      await removeUploadFile(user.avatarUrl, user.avatarStorageKey);
    }

    const uploadedAvatar = await storeUploadedFile(req.file, "avatars");
    user.avatarUrl = uploadedAvatar.url;
    user.avatarStorageKey = uploadedAvatar.storageKey || "";
    await user.save();

    res.json({
      message: "Profile photo updated.",
      user: serializeForViewer(user, req)
    });
  } catch (error) {
    next(error);
  }
};

export const blockUser = async (req, res, next) => {
  try {
    const { userId } = req.params;

    if (userId === req.user._id.toString()) {
      res.status(400);
      throw new Error("You cannot block yourself.");
    }

    const targetUser = await User.findById(userId).select(publicUserFields);

    if (!targetUser) {
      res.status(404);
      throw new Error("User not found.");
    }

    const currentUser = await User.findById(req.user._id).select(publicUserFields);
    currentUser.blockedUsers = Array.from(
      new Set([...currentUser.blockedUsers.map(String), targetUser._id.toString()])
    );
    await currentUser.save();

    const blockedUsers = await loadBlockedUsers(currentUser.blockedUsers);

    res.json({
      blockedUser: serializeForViewer(targetUser, { ...req, user: currentUser }),
      blockedUsers: blockedUsers.map((user) => serializeUser(user, { onlineUsers: req.app.get("onlineUsers"), viewer: currentUser })),
      message: `${targetUser.name} has been blocked.`,
      user: serializeUser(currentUser, { onlineUsers: req.app.get("onlineUsers"), viewer: currentUser })
    });
  } catch (error) {
    next(error);
  }
};

export const unblockUser = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const currentUser = await User.findById(req.user._id).select(publicUserFields);

    currentUser.blockedUsers = currentUser.blockedUsers.filter((blockedUserId) => blockedUserId.toString() !== userId);
    await currentUser.save();

    const blockedUsers = await loadBlockedUsers(currentUser.blockedUsers);

    res.json({
      blockedUserId: userId,
      blockedUsers: blockedUsers.map((user) => serializeUser(user, { onlineUsers: req.app.get("onlineUsers"), viewer: currentUser })),
      message: "User unblocked successfully.",
      user: serializeUser(currentUser, { onlineUsers: req.app.get("onlineUsers"), viewer: currentUser })
    });
  } catch (error) {
    next(error);
  }
};
