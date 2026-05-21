import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import User from "../models/User.js";
import { storeUploadedFile } from "../middleware/upload.js";
import { removeMessageAttachments } from "../utils/files.js";
import { getRelationshipState } from "../utils/relationships.js";
import { serializeConversation, serializeMessage } from "../utils/serializers.js";

const userFields = "name email avatarColor avatarUrl about blockedUsers lastSeenAt";

const populateConversation = (query) => query.populate("participants", userFields);
const serializeOptions = (req) => ({
  onlineUsers: req.app.get("onlineUsers"),
  viewer: req.user
});

const describeAttachmentKind = (mimeType = "") => {
  if (mimeType.startsWith("image/")) {
    return "image";
  }

  if (mimeType.startsWith("video/")) {
    return "video";
  }

  if (mimeType.startsWith("audio/")) {
    return "audio";
  }

  return "file";
};

const buildMessagePreview = (message) => {
  if (!message) {
    return "";
  }

  if (message.isDeleted) {
    return "Message deleted";
  }

  if (message.text?.trim()) {
    return message.text.trim().slice(0, 120);
  }

  if (message.attachments?.length) {
    const [attachment] = message.attachments;
    return attachment.kind === "image"
      ? "Photo"
      : attachment.kind === "video"
        ? "Video"
        : attachment.kind === "audio"
          ? "Voice note"
        : `File: ${attachment.originalName}`;
  }

  return "New message";
};

const getOtherParticipant = (conversation, currentUserId) =>
  conversation.participants.find((participant) => participant._id.toString() !== currentUserId.toString());

const assertMessagingAllowed = (currentUser, otherUser, res) => {
  const relationship = getRelationshipState(currentUser, otherUser);

  if (relationship.isBlocked) {
    res.status(403);
    throw new Error("Unblock this user before sending messages.");
  }

  if (relationship.hasBlockedYou) {
    res.status(403);
    throw new Error("This user blocked you, so new messages are disabled.");
  }
};

const assertGroupAdmin = (conversation, currentUserId, res) => {
  if (!conversation.groupAdmin || conversation.groupAdmin.toString() !== currentUserId.toString()) {
    res.status(403);
    throw new Error("Only the group admin can manage this group.");
  }
};

const ensureDistinctParticipants = (userIds = []) => Array.from(new Set(userIds.map((userId) => userId.toString())));

export const listConversations = async (req, res, next) => {
  try {
    const conversations = await populateConversation(
      Conversation.find({ participants: req.user._id }).sort({ lastMessageAt: -1 })
    );

    res.json(conversations.map((conversation) => serializeConversation(conversation, serializeOptions(req))));
  } catch (error) {
    next(error);
  }
};

export const createGroupConversation = async (req, res, next) => {
  try {
    const { description, name, participantIds = [] } = req.body;
    const uniqueParticipants = ensureDistinctParticipants([...participantIds, req.user._id.toString()]);

    if (!name?.trim()) {
      res.status(400);
      throw new Error("Group name is required.");
    }

    if (uniqueParticipants.length < 3) {
      res.status(400);
      throw new Error("Add at least two members to create a group.");
    }

    const users = await User.find({ _id: { $in: uniqueParticipants } }).select(userFields);

    if (users.length !== uniqueParticipants.length) {
      res.status(400);
      throw new Error("One or more selected users were not found.");
    }

    const conversation = await Conversation.create({
      groupAdmin: req.user._id,
      groupDescription: description?.trim() || "",
      groupName: name.trim(),
      kind: "group",
      participants: uniqueParticipants
    });

    const populatedConversation = await populateConversation(Conversation.findById(conversation._id));

    res.status(201).json(serializeConversation(populatedConversation, serializeOptions(req)));
  } catch (error) {
    next(error);
  }
};

export const updateGroupConversation = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const conversation = await populateConversation(
      Conversation.findOne({
        _id: conversationId,
        kind: "group",
        participants: req.user._id
      })
    );

    if (!conversation) {
      res.status(404);
      throw new Error("Group conversation not found.");
    }

    assertGroupAdmin(conversation, req.user._id, res);

    if (req.body?.name !== undefined) {
      const name = req.body.name.trim();

      if (!name) {
        res.status(400);
        throw new Error("Group name cannot be empty.");
      }

      conversation.groupName = name;
    }

    if (req.body?.description !== undefined) {
      conversation.groupDescription = req.body.description.trim();
    }

    await conversation.save();

    res.json(serializeConversation(conversation, serializeOptions(req)));
  } catch (error) {
    next(error);
  }
};

export const addGroupMembers = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const { participantIds = [] } = req.body;
    const conversation = await populateConversation(
      Conversation.findOne({
        _id: conversationId,
        kind: "group",
        participants: req.user._id
      })
    );

    if (!conversation) {
      res.status(404);
      throw new Error("Group conversation not found.");
    }

    assertGroupAdmin(conversation, req.user._id, res);

    const updatedParticipantIds = ensureDistinctParticipants([
      ...conversation.participants.map((participant) => participant._id.toString()),
      ...participantIds
    ]);

    const users = await User.find({ _id: { $in: updatedParticipantIds } }).select(userFields);

    if (users.length !== updatedParticipantIds.length) {
      res.status(400);
      throw new Error("One or more users were not found.");
    }

    conversation.participants = updatedParticipantIds;
    await conversation.save();

    const refreshedConversation = await populateConversation(Conversation.findById(conversation._id));
    res.json(serializeConversation(refreshedConversation, serializeOptions(req)));
  } catch (error) {
    next(error);
  }
};

export const removeGroupMember = async (req, res, next) => {
  try {
    const { conversationId, userId } = req.params;
    const conversation = await populateConversation(
      Conversation.findOne({
        _id: conversationId,
        kind: "group",
        participants: req.user._id
      })
    );

    if (!conversation) {
      res.status(404);
      throw new Error("Group conversation not found.");
    }

    assertGroupAdmin(conversation, req.user._id, res);

    conversation.participants = conversation.participants
      .map((participant) => participant._id?.toString?.() || participant.toString())
      .filter((participantId) => participantId !== userId);

    if (conversation.participants.length < 2) {
      res.status(400);
      throw new Error("A group must keep at least two members.");
    }

    await conversation.save();

    const refreshedConversation = await populateConversation(Conversation.findById(conversation._id));
    res.json(serializeConversation(refreshedConversation, serializeOptions(req)));
  } catch (error) {
    next(error);
  }
};

export const getDirectConversation = async (req, res, next) => {
  try {
    const otherUser = await User.findById(req.params.userId).select(userFields);

    if (!otherUser) {
      res.status(404);
      throw new Error("Selected user was not found.");
    }

    if (otherUser._id.toString() === req.user._id.toString()) {
      res.status(400);
      throw new Error("You cannot start a chat with yourself.");
    }

    assertMessagingAllowed(req.user, otherUser, res);

    let conversation = await populateConversation(
      Conversation.findOne({
        participants: { $all: [req.user._id, otherUser._id] },
        $expr: { $eq: [{ $size: "$participants" }, 2] }
      })
    );

    if (!conversation) {
      conversation = await Conversation.create({
        participants: [req.user._id, otherUser._id]
      });

      conversation = await populateConversation(Conversation.findById(conversation._id));
    }

    res.json(serializeConversation(conversation, serializeOptions(req)));
  } catch (error) {
    next(error);
  }
};

export const getMessages = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: req.user._id
    });

    if (!conversation) {
      res.status(404);
      throw new Error("Conversation not found.");
    }

    const messagesToMarkRead = await Message.find({
      conversation: conversationId,
      sender: { $ne: req.user._id },
      readBy: { $ne: req.user._id }
    }).select("_id");

    const messages = await Message.find({ conversation: conversationId })
      .sort({ createdAt: 1 })
      .populate("sender", userFields);

    await Message.updateMany(
      {
        conversation: conversationId,
        sender: { $ne: req.user._id },
        readBy: { $ne: req.user._id }
      },
      {
        $addToSet: {
          readBy: req.user._id
        }
      }
    );

    if (messagesToMarkRead.length) {
      const io = req.app.get("io");

      for (const participantId of conversation.participants) {
        io.to(participantId.toString()).emit("message:read", {
          conversationId,
          messageIds: messagesToMarkRead.map((message) => message._id.toString()),
          readerId: req.user._id.toString()
        });
      }
    }

    res.json(messages.map((message) => serializeMessage(message, serializeOptions(req))));
  } catch (error) {
    next(error);
  }
};

export const sendMessage = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const text = req.body?.text?.trim();
    const attachment = req.file || null;

    if (!text && !attachment) {
      res.status(400);
      throw new Error("Message text or an attachment is required.");
    }

    const existingConversation = await populateConversation(
      Conversation.findOne({
        _id: conversationId,
        participants: req.user._id
      })
    );

    if (!existingConversation) {
      res.status(404);
      throw new Error("Conversation not found.");
    }

    if (existingConversation.kind === "direct") {
      const otherUser = getOtherParticipant(existingConversation, req.user._id);
      assertMessagingAllowed(req.user, otherUser, res);
    }

    const uploadedAttachment = attachment ? await storeUploadedFile(attachment, "messages") : null;
    const attachments = attachment
      ? [
          {
            kind: describeAttachmentKind(attachment.mimetype),
            mimeType: attachment.mimetype,
            originalName: attachment.originalname,
            size: attachment.size,
            storageKey: uploadedAttachment?.storageKey || "",
            url: uploadedAttachment?.url || ""
          }
        ]
      : [];

    const createdMessage = await Message.create({
      attachments,
      conversation: conversationId,
      deliveredTo: existingConversation.participants
        .map((participant) => participant._id?.toString?.() || participant.toString())
        .filter((participantId) => participantId !== req.user._id.toString()),
      kind: attachments[0]?.kind || "text",
      sender: req.user._id,
      text: text || "",
      readBy: [req.user._id]
    });

    const message = await Message.findById(createdMessage._id).populate("sender", userFields);

    existingConversation.lastMessage = message._id;
    existingConversation.lastMessagePreview = buildMessagePreview(message);
    existingConversation.lastMessageAt = message.createdAt;
    await existingConversation.save();

    const io = req.app.get("io");
    const conversation = await populateConversation(Conversation.findById(existingConversation._id));

    const serializedConversation = serializeConversation(conversation, serializeOptions(req));
    const serializedMessage = serializeMessage(message, serializeOptions(req));

    for (const participant of conversation.participants) {
      io.to(participant._id.toString()).emit("message:new", {
        conversationId: conversation._id.toString(),
        conversation: serializedConversation,
        message: serializedMessage
      });
    }

    res.status(201).json({
      conversation: serializedConversation,
      message: serializedMessage
    });
  } catch (error) {
    next(error);
  }
};

export const deleteMessage = async (req, res, next) => {
  try {
    const { conversationId, messageId } = req.params;
    const conversation = await populateConversation(
      Conversation.findOne({
        _id: conversationId,
        participants: req.user._id
      })
    );

    if (!conversation) {
      res.status(404);
      throw new Error("Conversation not found.");
    }

    const message = await Message.findOne({
      _id: messageId,
      conversation: conversationId
    }).populate("sender", userFields);

    if (!message) {
      res.status(404);
      throw new Error("Message not found.");
    }

    if (message.sender._id.toString() !== req.user._id.toString()) {
      res.status(403);
      throw new Error("Only your own messages can be deleted.");
    }

    const attachments = [...(message.attachments || [])];

    message.text = "";
    message.kind = "text";
    message.attachments = [];
    message.isDeleted = true;
    message.deletedAt = new Date();
    message.deletedForEveryone = true;
    await message.save();

    if (conversation.lastMessage?.toString() === message._id.toString()) {
      conversation.lastMessagePreview = "Message deleted";
      await conversation.save();
    }

    await removeMessageAttachments(attachments);

    const serializedMessage = serializeMessage(message, serializeOptions(req));
    const io = req.app.get("io");

    for (const participant of conversation.participants) {
      io.to(participant._id.toString()).emit("message:deleted", {
        conversationId,
        message: serializedMessage
      });
    }

    res.json({
      message: serializedMessage
    });
  } catch (error) {
    next(error);
  }
};

export const deleteConversation = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const conversation = await populateConversation(
      Conversation.findOne({
        _id: conversationId,
        participants: req.user._id
      })
    );

    if (!conversation) {
      res.status(404);
      throw new Error("Conversation not found.");
    }

    const messages = await Message.find({ conversation: conversationId });
    await removeMessageAttachments(messages.flatMap((message) => message.attachments || []));
    await Message.deleteMany({ conversation: conversationId });
    await conversation.deleteOne();

    const io = req.app.get("io");

    for (const participant of conversation.participants) {
      io.to(participant._id.toString()).emit("chat:deleted", {
        conversationId
      });
    }

    res.json({
      conversationId,
      message: "Chat deleted successfully."
    });
  } catch (error) {
    next(error);
  }
};
