const toId = (value) => value?._id?.toString?.() || value?.toString?.() || "";

export const hasBlockedUser = (user, targetId) =>
  (user?.blockedUsers || []).some((value) => toId(value) === toId(targetId));

export const getRelationshipState = (viewer, targetUser) => ({
  hasBlockedYou: hasBlockedUser(targetUser, viewer?._id),
  isBlocked: hasBlockedUser(viewer, targetUser?._id)
});
