const assetBaseUrl =
  import.meta.env.VITE_SOCKET_URL ||
  (import.meta.env.VITE_API_URL || "http://localhost:5000/api").replace(/\/api\/?$/, "");

export const resolveAssetUrl = (value = "") => {
  if (!value) {
    return "";
  }

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  return `${assetBaseUrl}${value.startsWith("/") ? value : `/${value}`}`;
};
