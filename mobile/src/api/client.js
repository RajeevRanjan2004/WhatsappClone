import axios from "axios";

const fallbackApiUrl = "http://localhost:5000/api";
const apiUrl = process.env.EXPO_PUBLIC_API_URL || fallbackApiUrl;
const socketUrl = process.env.EXPO_PUBLIC_SOCKET_URL || apiUrl.replace(/\/api\/?$/, "");

const apiClient = axios.create({
  baseURL: apiUrl
});

export const setAuthToken = (token) => {
  if (token) {
    apiClient.defaults.headers.common.Authorization = `Bearer ${token}`;
    return;
  }

  delete apiClient.defaults.headers.common.Authorization;
};

export const resolveAssetUrl = (value = "") => {
  if (!value) {
    return "";
  }

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  return `${socketUrl}${value.startsWith("/") ? value : `/${value}`}`;
};

export const realtimeUrl = socketUrl;

export default apiClient;
