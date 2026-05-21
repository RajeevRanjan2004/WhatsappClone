const palette = ["#19c37d", "#00a884", "#0ea5e9", "#f59e0b", "#ec4899", "#8b5cf6", "#ef4444"];

export const getAvatarColor = (name = "") => {
  const total = [...name.trim()].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return palette[total % palette.length];
};

