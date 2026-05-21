export const getOtherParticipant = (conversation, currentUserId) =>
  conversation?.participants?.find((participant) => participant._id !== currentUserId?.toString?.()) ||
  conversation?.participants?.[0] ||
  null;

export const getConversationTitle = (conversation, currentUserId) => {
  if (!conversation) {
    return "Conversation";
  }

  if (conversation.kind === "group") {
    return conversation.groupName || "Group";
  }

  return getOtherParticipant(conversation, currentUserId)?.name || "Conversation";
};

export const getConversationSubtitle = (conversation, currentUserId) => {
  if (!conversation) {
    return "";
  }

  if (conversation.kind === "group") {
    return conversation.groupDescription || `${conversation.participants?.length || 0} members`;
  }

  const otherUser = getOtherParticipant(conversation, currentUserId);

  if (otherUser?.isOnline) {
    return "Online now";
  }

  if (otherUser?.lastSeenAt) {
    return `Last seen ${new Intl.DateTimeFormat([], {
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      month: "short"
    }).format(new Date(otherUser.lastSeenAt))}`;
  }

  return otherUser?.about || otherUser?.email || "";
};

export const getConversationAvatar = (conversation, currentUserId) => {
  if (!conversation) {
    return null;
  }

  if (conversation.kind === "group") {
    return {
      _id: conversation._id,
      avatarColor: "#0b5f4a",
      avatarUrl: conversation.groupAvatarUrl || "",
      name: conversation.groupName || "Group"
    };
  }

  return getOtherParticipant(conversation, currentUserId);
};

const toTime = (value) => new Date(value || 0).getTime();

export const sortConversations = (conversations) =>
  [...conversations].sort((left, right) => toTime(right.lastMessageAt) - toTime(left.lastMessageAt));

export const upsertConversation = (conversations, conversation) =>
  sortConversations([conversation, ...conversations.filter((item) => item._id !== conversation._id)]);

export const upsertMessage = (messages, message) => {
  return [...messages.filter((item) => item._id !== message._id), message].sort(
    (left, right) => toTime(left.createdAt) - toTime(right.createdAt)
  );
};

export const removeConversation = (conversations, conversationId) =>
  conversations.filter((conversation) => conversation._id !== conversationId);

export const replaceUserInCollection = (users, updatedUser) =>
  users.map((user) => (user._id === updatedUser._id ? { ...user, ...updatedUser } : user));

export const replaceUserInConversations = (conversations, updatedUser) =>
  conversations.map((conversation) => ({
    ...conversation,
    participants: conversation.participants.map((participant) =>
      participant._id === updatedUser._id ? { ...participant, ...updatedUser } : participant
    )
  }));

export const applyPresenceToUsers = (users, onlineUserIds) =>
  users.map((user) => ({
    ...user,
    isOnline: onlineUserIds.includes(user._id)
  }));

export const applyPresenceToConversations = (conversations, onlineUserIds) =>
  conversations.map((conversation) => ({
    ...conversation,
    participants: conversation.participants.map((participant) => ({
      ...participant,
      isOnline: onlineUserIds.includes(participant._id)
    }))
  }));

export const patchUserPresence = (users, userId, isOnline, lastSeenAt) =>
  users.map((user) => (user._id === userId ? { ...user, isOnline, lastSeenAt: lastSeenAt || user.lastSeenAt } : user));

export const patchConversationPresence = (conversations, userId, isOnline, lastSeenAt) =>
  conversations.map((conversation) => ({
    ...conversation,
    participants: conversation.participants.map((participant) =>
      participant._id === userId ? { ...participant, isOnline, lastSeenAt: lastSeenAt || participant.lastSeenAt } : participant
    )
  }));

export const formatSidebarTime = (value) => {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  const now = new Date();
  const isSameDay = date.toDateString() === now.toDateString();
  const isSameYear = date.getFullYear() === now.getFullYear();

  if (isSameDay) {
    return new Intl.DateTimeFormat([], { hour: "numeric", minute: "2-digit" }).format(date);
  }

  if (isSameYear) {
    return new Intl.DateTimeFormat([], { month: "short", day: "numeric" }).format(date);
  }

  return new Intl.DateTimeFormat([], { year: "2-digit", month: "short", day: "numeric" }).format(date);
};

export const formatMessageTime = (value) =>
  new Intl.DateTimeFormat([], {
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));

export const formatMessageDay = (value) => {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  const now = new Date();
  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);

  if (date.toDateString() === now.toDateString()) {
    return "Today";
  }

  if (date.toDateString() === yesterday.toDateString()) {
    return "Yesterday";
  }

  return new Intl.DateTimeFormat([], {
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(date);
};

export const formatStoryTime = (value) =>
  new Intl.DateTimeFormat([], {
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));

export const formatBytes = (bytes = 0) => {
  if (!bytes) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;

  return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
};

export const isConversationRestricted = (conversation, currentUserId) => {
  if (conversation?.kind === "group") {
    return false;
  }

  const otherUser = getOtherParticipant(conversation, currentUserId);
  return Boolean(otherUser?.isBlocked || otherUser?.hasBlockedYou);
};

export const getReadReceiptLabel = (message, currentUserId) => {
  if (message.sender?._id !== currentUserId) {
    return "";
  }

  const readCount = message.readBy?.filter((userId) => userId !== currentUserId).length || 0;
  const deliveredCount = message.deliveredTo?.filter((userId) => userId !== currentUserId).length || 0;

  if (readCount > 0) {
    return "Read";
  }

  if (deliveredCount > 0) {
    return "Delivered";
  }

  return "Sent";
};

export const getContactDisplayNumber = (user) => {
  if (!user) {
    return "";
  }

  const source = `${user.email || ""}${user._id || ""}`;
  const digits = source
    .split("")
    .map((character) => character.charCodeAt(0) % 10)
    .join("")
    .padEnd(10, "0")
    .slice(0, 10);

  return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
};
