import { getRelationshipState } from "./relationships.js";

const toId = (value) => value?._id?.toString?.() || value?.toString?.() || "";

export const serializeUser = (user, options = {}) => {
  const viewer = options.viewer || null;
  const { hasBlockedYou, isBlocked } = viewer ? getRelationshipState(viewer, user) : { hasBlockedYou: false, isBlocked: false };

  return {
    _id: toId(user),
    name: user.name,
    email: user.email,
    avatarColor: user.avatarColor,
    avatarUrl: user.avatarUrl || "",
    about: user.about,
    hasBlockedYou,
    isBlocked,
    isOnline: options.onlineUsers ? options.onlineUsers.has(toId(user)) : Boolean(user.isOnline),
    lastSeenAt: user.lastSeenAt || null
  };
};

export const serializeConversation = (conversation, options = {}) => ({
  _id: toId(conversation),
  groupAdmin: conversation.groupAdmin ? toId(conversation.groupAdmin) : null,
  groupAvatarUrl: conversation.groupAvatarUrl || "",
  groupDescription: conversation.groupDescription || "",
  groupName: conversation.groupName || "",
  kind: conversation.kind || "direct",
  participants: (conversation.participants || []).map((participant) => serializeUser(participant, options)),
  lastMessage: conversation.lastMessage ? toId(conversation.lastMessage) : null,
  lastMessagePreview: conversation.lastMessagePreview || "",
  lastMessageAt: conversation.lastMessageAt,
  createdAt: conversation.createdAt,
  updatedAt: conversation.updatedAt
});

export const serializeMessage = (message, options = {}) => ({
  _id: toId(message),
  attachments: (message.attachments || []).map((attachment) => ({
    kind: attachment.kind,
    mimeType: attachment.mimeType,
    originalName: attachment.originalName,
    size: attachment.size,
    storageKey: attachment.storageKey || "",
    url: attachment.url
  })),
  conversation: toId(message.conversation),
  createdAt: message.createdAt,
  deletedAt: message.deletedAt,
  deletedForEveryone: Boolean(message.deletedForEveryone),
  deliveredTo: (message.deliveredTo || []).map((userId) => toId(userId)),
  isDeleted: Boolean(message.isDeleted),
  kind: message.kind || "text",
  readBy: (message.readBy || []).map((userId) => toId(userId)),
  sender: typeof message.sender === "object" ? serializeUser(message.sender, options) : { _id: toId(message.sender) },
  text: message.text || "",
  updatedAt: message.updatedAt
});

export const serializeStory = (story, options = {}) => ({
  _id: toId(story),
  author: typeof story.author === "object" ? serializeUser(story.author, options) : { _id: toId(story.author) },
  caption: story.caption || "",
  createdAt: story.createdAt,
  expiresAt: story.expiresAt,
  kind: story.kind || "text",
  mediaMimeType: story.mediaMimeType || "",
  mediaStorageKey: story.mediaStorageKey || "",
  mediaUrl: story.mediaUrl || "",
  text: story.text || "",
  viewers: (story.viewers || []).map((userId) => toId(userId))
});
