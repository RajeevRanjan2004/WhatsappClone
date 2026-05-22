import React, { useEffect, useMemo, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  Alert,
  Image,
  InteractionManager,
  KeyboardAvoidingView,
  Linking,
  Modal,
  PermissionsAndroid,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View
} from "react-native";
import InCallManager from "react-native-incall-manager";
import {
  RTCIceCandidate,
  RTCPeerConnection,
  RTCSessionDescription,
  mediaDevices
} from "react-native-webrtc";
import { io } from "socket.io-client";

import apiClient, { resolveAssetUrl, realtimeUrl } from "../api/client";
import AvatarBadge from "../components/AvatarBadge";
import CallModal from "../components/CallModal";
import MessageActionSheet from "../components/MessageActionSheet";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import {
  applyPresenceToConversations,
  applyPresenceToUsers,
  formatBytes,
  formatMessageDay,
  formatMessageTime,
  formatSidebarTime,
  formatStoryTime,
  getConversationAvatar,
  getConversationSubtitle,
  getConversationTitle,
  getOtherParticipant,
  isConversationRestricted,
  patchConversationPresence,
  patchUserPresence,
  removeConversation,
  sortConversations,
  upsertConversation,
  upsertMessage
} from "../utils/chat";

const hiddenMessageStoragePrefix = "pulsechat-rn:hidden-messages";
const parseIceServers = () => {
  const configuredIceServers = process.env.EXPO_PUBLIC_ICE_SERVERS;

  if (configuredIceServers) {
    try {
      const parsed = JSON.parse(configuredIceServers);

      if (Array.isArray(parsed) && parsed.length) {
        return parsed;
      }
    } catch {
      // Fall through to STUN/TURN env parsing.
    }
  }

  const parseUrlList = (value = "") =>
    value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

  const stunUrls = parseUrlList(process.env.EXPO_PUBLIC_STUN_URLS || "stun:stun.l.google.com:19302");
  const turnUrls = parseUrlList(process.env.EXPO_PUBLIC_TURN_URLS || "");
  const turnUsername = process.env.EXPO_PUBLIC_TURN_USERNAME || "";
  const turnCredential = process.env.EXPO_PUBLIC_TURN_CREDENTIAL || "";

  const iceServers = stunUrls.map((urls) => ({ urls }));

  if (turnUrls.length && turnUsername && turnCredential) {
    iceServers.push({
      credential: turnCredential,
      urls: turnUrls,
      username: turnUsername
    });
  }

  return iceServers.length ? iceServers : [{ urls: "stun:stun.l.google.com:19302" }];
};
const rtcConfig = {
  iceServers: parseIceServers()
};
const defaultCallState = {
  connectedAt: null,
  conversationId: null,
  direction: null,
  isMicMuted: false,
  isSpeakerOn: false,
  isVideoEnabled: true,
  open: false,
  partner: null,
  phase: "idle",
  startedAt: null,
  status: "",
  type: "audio"
};

export default function HomeScreen() {
  const { logout, setCurrentUser, token, user } = useAuth();
  const { theme, themeName, toggleTheme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [activeTab, setActiveTab] = useState("chats");
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [callState, setCallState] = useState(defaultCallState);
  const [chatSearchQuery, setChatSearchQuery] = useState("");
  const [chatSearchVisible, setChatSearchVisible] = useState(false);
  const [changePasswordForm, setChangePasswordForm] = useState({
    currentPassword: "",
    newPassword: ""
  });
  const [composerText, setComposerText] = useState("");
  const [conversationPrefs, setConversationPrefs] = useState({});
  const [contacts, setContacts] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [error, setError] = useState("");
  const [hiddenMessageMap, setHiddenMessageMap] = useState({});
  const [isChatInfoVisible, setIsChatInfoVisible] = useState(false);
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [isSettingsVisible, setIsSettingsVisible] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [messages, setMessages] = useState([]);
  const [notice, setNotice] = useState("");
  const [localStream, setLocalStream] = useState(null);
  const [pendingAttachment, setPendingAttachment] = useState(null);
  const [profileForm, setProfileForm] = useState({
    about: "",
    name: ""
  });
  const [remoteStream, setRemoteStream] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [settingsSection, setSettingsSection] = useState("root");
  const [stories, setStories] = useState([]);
  const [tabFilter, setTabFilter] = useState("all");
  const [uiPrefs, setUiPrefs] = useState({
    mediaAutoDownload: false,
    readReceipts: true,
    showLastSeen: true
  });
  const [unreadMap, setUnreadMap] = useState({});

  const activeConversationRef = useRef(activeConversationId);
  const backgroundPrefetchStartedRef = useRef(false);
  const blockedUsersLoadedRef = useRef(false);
  const blockedUsersRequestRef = useRef(null);
  const callStateRef = useRef(callState);
  const chatScrollRef = useRef(null);
  const incomingOfferRef = useRef(null);
  const localStreamRef = useRef(null);
  const pendingIceCandidatesRef = useRef([]);
  const peerConnectionRef = useRef(null);
  const socketRef = useRef(null);
  const storiesLoadedRef = useRef(false);
  const storiesRequestRef = useRef(null);
  const defaultConversationPrefs = {
    advancedPrivacy: false,
    disappearing: false,
    favorite: false,
    locked: false,
    mediaVisibility: true,
    notifications: true,
    savedToList: false
  };

  useEffect(() => {
    activeConversationRef.current = activeConversationId;
  }, [activeConversationId]);

  useEffect(() => {
    callStateRef.current = callState;
  }, [callState]);

  useEffect(() => {
    setProfileForm({
      about: user?.about || "",
      name: user?.name || ""
    });
  }, [user?.about, user?.name]);

  useEffect(() => {
    if (!notice) {
      return undefined;
    }

    const timeoutId = setTimeout(() => setNotice(""), 2200);
    return () => clearTimeout(timeoutId);
  }, [notice]);

  useEffect(() => {
    if (!user?._id) {
      return;
    }

    let ignore = false;

    const loadHiddenMessages = async () => {
      try {
        const savedValue = await AsyncStorage.getItem(`${hiddenMessageStoragePrefix}:${user._id}`);

        if (!ignore && savedValue) {
          setHiddenMessageMap(JSON.parse(savedValue));
        }
      } catch {
        if (!ignore) {
          setHiddenMessageMap({});
        }
      }
    };

    void loadHiddenMessages();

    return () => {
      ignore = true;
    };
  }, [user?._id]);

  useEffect(() => {
    if (!user?._id) {
      return;
    }

    void AsyncStorage.setItem(`${hiddenMessageStoragePrefix}:${user._id}`, JSON.stringify(hiddenMessageMap));
  }, [hiddenMessageMap, user?._id]);

  const loadStories = async ({ force = false, silent = true } = {}) => {
    if (!force && storiesLoadedRef.current) {
      return stories;
    }

    if (storiesRequestRef.current) {
      return storiesRequestRef.current;
    }

    const request = apiClient
      .get("/stories")
      .then((response) => {
        storiesLoadedRef.current = true;
        setStories(response.data);
        return response.data;
      })
      .catch((requestError) => {
        if (!silent) {
          setError(getRequestMessage(requestError, "Unable to load status updates."));
        }

        return [];
      })
      .finally(() => {
        storiesRequestRef.current = null;
      });

    storiesRequestRef.current = request;
    return request;
  };

  const loadBlockedUsers = async ({ force = false, silent = true } = {}) => {
    if (!force && blockedUsersLoadedRef.current) {
      return blockedUsers;
    }

    if (blockedUsersRequestRef.current) {
      return blockedUsersRequestRef.current;
    }

    const request = apiClient
      .get("/users/blocked")
      .then((response) => {
        blockedUsersLoadedRef.current = true;
        setBlockedUsers(response.data);
        return response.data;
      })
      .catch((requestError) => {
        if (!silent) {
          setError(getRequestMessage(requestError, "Unable to load blocked users."));
        }

        return [];
      })
      .finally(() => {
        blockedUsersRequestRef.current = null;
      });

    blockedUsersRequestRef.current = request;
    return request;
  };

  const loadChats = async ({ allowRetry = true } = {}) => {
    try {
      const response = await apiClient.get("/chats");
      return sortConversations(response.data);
    } catch (requestError) {
      if (allowRetry && ["ECONNABORTED", "ERR_NETWORK"].includes(requestError?.code)) {
        await new Promise((resolve) => setTimeout(resolve, 2500));
        return loadChats({ allowRetry: false });
      }

      throw requestError;
    }
  };

  useEffect(() => {
    let ignore = false;
    let interactionTask;

    const hydrateDashboard = async () => {
      setError("");
      setIsPageLoading(true);

      try {
        const nextConversations = await loadChats();

        if (ignore) {
          return;
        }

        setConversations(nextConversations);

        if (!backgroundPrefetchStartedRef.current) {
          backgroundPrefetchStartedRef.current = true;
          interactionTask = InteractionManager.runAfterInteractions(() => {
            if (!ignore) {
              void Promise.allSettled([loadStories(), loadBlockedUsers()]);
            }
          });
        }
      } catch (requestError) {
        if (!ignore) {
          setError(getRequestMessage(requestError, "Unable to load chats right now."));
        }
      } finally {
        if (!ignore) {
          setIsPageLoading(false);
        }
      }
    };

    void hydrateDashboard();

    return () => {
      ignore = true;
      interactionTask?.cancel?.();
    };
  }, []);

  useEffect(() => {
    if (activeTab === "updates" && !storiesLoadedRef.current) {
      void loadStories({ silent: false });
    }
  }, [activeTab]);

  useEffect(() => {
    if (isSettingsVisible && settingsSection === "privacy" && !blockedUsersLoadedRef.current) {
      void loadBlockedUsers({ silent: false });
    }
  }, [isSettingsVisible, settingsSection]);

  useEffect(() => {
    if (!activeConversationId) {
      setMessages([]);
      return;
    }

    let ignore = false;

    const loadMessages = async () => {
      setIsLoadingMessages(true);

      try {
        const response = await apiClient.get(`/chats/${activeConversationId}/messages`);

        if (ignore) {
          return;
        }

        setMessages(response.data);
        setUnreadMap((current) => ({
          ...current,
          [activeConversationId]: 0
        }));
      } catch (requestError) {
        if (!ignore) {
          setError(getRequestMessage(requestError, "Unable to load this conversation."));
        }
      } finally {
        if (!ignore) {
          setIsLoadingMessages(false);
        }
      }
    };

    void loadMessages();

    return () => {
      ignore = true;
    };
  }, [activeConversationId]);

  const resetCallMedia = () => {
    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;

    localStreamRef.current?.getTracks?.().forEach((track) => track.stop());
    localStreamRef.current = null;

    incomingOfferRef.current = null;
    pendingIceCandidatesRef.current = [];
    setLocalStream(null);
    setRemoteStream(null);
  };

  const applySpeakerRoute = (enabled) => {
    try {
      InCallManager.setForceSpeakerphoneOn?.(enabled);
    } catch {
      // Ignore speaker routing issues.
    }

    try {
      InCallManager.setSpeakerphoneOn?.(enabled);
    } catch {
      // Ignore speaker routing issues.
    }
  };

  const stopInCallAudioSession = () => {
    applySpeakerRoute(false);

    try {
      InCallManager.stop?.();
    } catch {
      // Ignore audio session teardown issues.
    }
  };

  const endCallSession = ({ emitDecline = false, emitEnd = true, reason = "ended" } = {}) => {
    if (!callStateRef.current.open) {
      return;
    }

    const partnerId = callStateRef.current.partner?._id;

    if (partnerId && socketRef.current) {
      if (emitDecline) {
        socketRef.current.emit("call:decline", { reason: "declined", toUserId: partnerId });
      } else if (emitEnd) {
        socketRef.current.emit("call:end", { toUserId: partnerId });
      }
    }

    if (reason === "remote-ended") {
      showNotice("Call ended.");
    } else if (reason === "missed") {
      showNotice("Missed call.");
    }

    if (reason === "connection-lost") {
      setError("Call connection lost ho gaya.");
    }

    stopInCallAudioSession();
    callStateRef.current = defaultCallState;
    resetCallMedia();
    setCallState(defaultCallState);
  };

  const flushPendingIceCandidates = async () => {
    if (!peerConnectionRef.current || !pendingIceCandidatesRef.current.length) {
      return;
    }

    const candidates = [...pendingIceCandidatesRef.current];
    pendingIceCandidatesRef.current = [];

    for (const candidate of candidates) {
      try {
        await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
      } catch {
        // Ignore invalid queued candidates.
      }
    }
  };

  const createPeerConnection = (partnerId) => {
    const peerConnection = new RTCPeerConnection(rtcConfig);

    peerConnection.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit("call:ice-candidate", {
          candidate: event.candidate,
          toUserId: partnerId
        });
      }
    };

    peerConnection.ontrack = (event) => {
      const [stream] = event.streams;
      setRemoteStream(stream || null);
    };

    peerConnection.onconnectionstatechange = () => {
      if (!callStateRef.current.open) {
        return;
      }

      if (peerConnection.connectionState === "connected") {
        setCallState((current) => ({
          ...current,
          connectedAt: current.connectedAt || new Date().toISOString(),
          phase: "active",
          status: "Call connected"
        }));
        return;
      }

      if (peerConnection.connectionState === "disconnected") {
        setCallState((current) => ({
          ...current,
          status: "Connection unstable..."
        }));
        return;
      }

      if (["closed", "failed"].includes(peerConnection.connectionState)) {
        endCallSession({
          emitEnd: false,
          reason: peerConnection.connectionState === "failed" ? "connection-lost" : "remote-ended"
        });
      }
    };

    peerConnectionRef.current = peerConnection;
    return peerConnection;
  };

  useEffect(() => {
    if (!callState.open) {
      return undefined;
    }

    try {
      InCallManager.start?.({
        media: callState.type === "video" ? "video" : "audio"
      });
    } catch {
      // Ignore native call audio setup issues.
    }

    applySpeakerRoute(callState.isSpeakerOn);

    return () => {
      stopInCallAudioSession();
    };
  }, [callState.isSpeakerOn, callState.open, callState.type]);

  const ensureCallPermissions = async (type) => {
    if (Platform.OS !== "android") {
      return;
    }

    const permissions = [PermissionsAndroid.PERMISSIONS.RECORD_AUDIO];

    if (type === "video") {
      permissions.push(PermissionsAndroid.PERMISSIONS.CAMERA);
    }

    const result = await PermissionsAndroid.requestMultiple(permissions);
    const deniedPermissions = permissions.filter(
      (permission) => result[permission] !== PermissionsAndroid.RESULTS.GRANTED
    );

    if (deniedPermissions.length) {
      throw new Error("Microphone ya camera permission allow karna hoga.");
    }
  };

  const getUserMediaStream = async (type) => {
    await ensureCallPermissions(type);

    const stream = await mediaDevices.getUserMedia({
      audio: true,
      video:
        type === "video"
          ? {
              facingMode: "user",
              frameRate: 24,
              height: 720,
              width: 1280
            }
          : false
    });

    localStreamRef.current = stream;
    setLocalStream(stream);
    return stream;
  };

  useEffect(() => {
    if (!token || !user?._id) {
      return undefined;
    }

    const socket = io(realtimeUrl, {
      auth: { token },
      transports: ["websocket"]
    });

    socketRef.current = socket;

    socket.on("presence:list", ({ userIds }) => {
      setContacts((current) => applyPresenceToUsers(current, userIds));
      setConversations((current) => applyPresenceToConversations(current, userIds));
    });

    socket.on("presence:update", ({ isOnline, lastSeenAt, userId }) => {
      setContacts((current) => patchUserPresence(current, userId, isOnline, lastSeenAt));
      setConversations((current) => patchConversationPresence(current, userId, isOnline, lastSeenAt));
    });

    socket.on("message:new", ({ conversationId, conversation, message }) => {
      setConversations((current) => upsertConversation(current, conversation));

      if (activeConversationRef.current === conversationId) {
        setMessages((current) => upsertMessage(current, message));
        setUnreadMap((current) => ({
          ...current,
          [conversationId]: 0
        }));
      } else if (message.sender?._id !== user._id) {
        setUnreadMap((current) => ({
          ...current,
          [conversationId]: (current[conversationId] || 0) + 1
        }));
      }
    });

    socket.on("message:deleted", ({ conversationId, message }) => {
      setMessages((current) => upsertMessage(current, message));
      setConversations((current) =>
        current.map((conversation) =>
          conversation._id === conversationId && conversation.lastMessage === message._id
            ? { ...conversation, lastMessagePreview: "Message deleted" }
            : conversation
        )
      );
    });

    socket.on("chat:deleted", ({ conversationId }) => {
      setConversations((current) => removeConversation(current, conversationId));

      if (activeConversationRef.current === conversationId) {
        setActiveConversationId(null);
        setMessages([]);
      }
    });

    socket.on("story:new", async () => {
      try {
        await loadStories({ force: true });
      } catch {
        // Ignore story refresh issues in the background.
      }
    });

    socket.on("call:offer", ({ callType, conversationId, fromUser, sdp }) => {
      if (callStateRef.current.open) {
        socket.emit("call:decline", { reason: "busy", toUserId: fromUser._id });
        return;
      }

      incomingOfferRef.current = sdp;
      setActiveConversationId(conversationId);
      setActiveTab("chats");
      setIsChatInfoVisible(false);
      setChatSearchVisible(false);
      setCallState({
        connectedAt: null,
        conversationId,
        direction: "incoming",
        isMicMuted: false,
        isSpeakerOn: callType === "video",
        isVideoEnabled: callType === "video",
        open: true,
        partner: fromUser,
        phase: "incoming",
        startedAt: new Date().toISOString(),
        status: `${fromUser.name} is calling...`,
        type: callType
      });
    });

    socket.on("call:answer", async ({ sdp }) => {
      try {
        await peerConnectionRef.current?.setRemoteDescription(new RTCSessionDescription(sdp));
        await flushPendingIceCandidates();
        setCallState((current) => ({
          ...current,
          connectedAt: current.connectedAt || new Date().toISOString(),
          phase: "active",
          status: "Call connected"
        }));
      } catch {
        endCallSession({ emitEnd: false, reason: "connection-lost" });
      }
    });

    socket.on("call:ice-candidate", async ({ candidate }) => {
      try {
        if (!candidate) {
          return;
        }

        if (peerConnectionRef.current?.remoteDescription?.type) {
          await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
          return;
        }

        pendingIceCandidatesRef.current.push(candidate);
      } catch {
        // Ignore transient ICE sync failures.
      }
    });

    socket.on("call:decline", ({ reason }) => {
      endCallSession({ emitEnd: false, reason: reason === "busy" ? "busy" : "declined" });
      setError(reason === "busy" ? "Other user abhi busy hai." : "Call decline kar diya gaya.");
    });

    socket.on("call:end", () => {
      endCallSession({
        emitEnd: false,
        reason: callStateRef.current.phase === "incoming" ? "missed" : "remote-ended"
      });
    });

    socket.on("connect_error", () => {
      setError("Realtime socket connect nahi hua. Backend URL ya public socket URL check karo.");
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      resetCallMedia();
    };
  }, [token, user?._id]);

  useEffect(() => {
    if (activeConversationId) {
      return;
    }

    setChatSearchVisible(false);
    setChatSearchQuery("");
    setIsChatInfoVisible(false);
    setPendingAttachment(null);
  }, [activeConversationId]);

  useEffect(() => {
    if (!activeConversationId || !messages.length) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      chatScrollRef.current?.scrollToEnd({ animated: true });
    });

    return () => cancelAnimationFrame(frame);
  }, [activeConversationId, messages]);

  const showNotice = (value) => {
    setNotice(value);
  };

  const getConversationPreferences = (conversationId) => ({
    ...defaultConversationPrefs,
    ...(conversationPrefs[conversationId] || {})
  });

  const updateConversationPreferences = (conversationId, patch) => {
    setConversationPrefs((current) => ({
      ...current,
      [conversationId]: {
        ...defaultConversationPrefs,
        ...(current[conversationId] || {}),
        ...patch
      }
    }));
  };

  const toggleConversationPreference = (conversationId, key) => {
    const current = getConversationPreferences(conversationId);
    updateConversationPreferences(conversationId, { [key]: !current[key] });
  };

  const openSettingsSection = (section = "root") => {
    setIsMenuVisible(false);
    setSettingsSection(section);
    setIsSettingsVisible(true);
  };

  const closeSettings = () => {
    setSettingsSection("root");
    setIsSettingsVisible(false);
  };

  const updateUiPreference = (key, value) => {
    setUiPrefs((current) => ({
      ...current,
      [key]: value
    }));
  };

  const inferMimeTypeFromName = (name = "") => {
    const extension = name.split(".").pop()?.toLowerCase?.() || "";
    const mimeTypes = {
      doc: "application/msword",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      jpeg: "image/jpeg",
      jpg: "image/jpeg",
      mp3: "audio/mpeg",
      mp4: "video/mp4",
      pdf: "application/pdf",
      png: "image/png",
      ppt: "application/vnd.ms-powerpoint",
      pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      txt: "text/plain",
      wav: "audio/wav",
      xls: "application/vnd.ms-excel",
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      zip: "application/zip"
    };

    return mimeTypes[extension] || "application/octet-stream";
  };

  const normalizePickedAttachment = (asset, fallbackKind = "file") => {
    if (!asset?.uri) {
      return null;
    }

    const name = asset.fileName || asset.name || `attachment-${Date.now()}`;
    const mimeType =
      asset.mimeType || asset.type || (fallbackKind === "image" ? "image/jpeg" : fallbackKind === "video" ? "video/mp4" : inferMimeTypeFromName(name));
    const kind = mimeType.startsWith("image/")
      ? "image"
      : mimeType.startsWith("video/")
        ? "video"
        : mimeType.startsWith("audio/")
          ? "audio"
          : "file";

    return {
      kind,
      mimeType,
      name,
      size: asset.fileSize || asset.size || 0,
      uri: asset.uri
    };
  };

  const openAttachmentUrl = async (attachment) => {
    const targetUrl = resolveAssetUrl(attachment?.url);

    if (!targetUrl) {
      return;
    }

    try {
      await Linking.openURL(targetUrl);
    } catch {
      setError("Attachment open nahi ho paaya.");
    }
  };

  const pickFromLibrary = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      setError("Gallery permission allow karna hoga.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: false,
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 0.9
    });

    if (result.canceled) {
      return;
    }

    const asset = normalizePickedAttachment(result.assets?.[0], result.assets?.[0]?.type);

    if (asset) {
      setPendingAttachment(asset);
      showNotice(`${asset.kind === "image" ? "Photo" : asset.kind === "video" ? "Video" : "File"} selected.`);
    }
  };

  const pickFromCamera = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();

    if (!permission.granted) {
      setError("Camera permission allow karna hoga.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 0.9,
      videoMaxDuration: 300
    });

    if (result.canceled) {
      return;
    }

    const asset = normalizePickedAttachment(result.assets?.[0], result.assets?.[0]?.type);

    if (asset) {
      setPendingAttachment(asset);
      showNotice(`${asset.kind === "image" ? "Photo" : asset.kind === "video" ? "Video" : "File"} captured.`);
    }
  };

  const pickDocumentFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: false,
      type: "*/*"
    });

    if (result.canceled) {
      return;
    }

    const asset = normalizePickedAttachment(result.assets?.[0], "file");

    if (asset) {
      setPendingAttachment(asset);
      showNotice("File selected.");
    }
  };

  const openAttachmentPicker = () => {
    Alert.alert("Send attachment", "Choose what you want to send.", [
      { text: "Cancel", style: "cancel" },
      { text: "Camera", onPress: () => void pickFromCamera() },
      { text: "Photo / Video", onPress: () => void pickFromLibrary() },
      { text: "Document", onPress: () => void pickDocumentFile() }
    ]);
  };

  const handleSelectConversation = (conversationId) => {
    setActiveTab("chats");
    setActiveConversationId(conversationId);
    setPendingAttachment(null);
    setSearchQuery("");
  };

  const handleStartConversation = async (targetUserId) => {
    const existingConversation = conversations.find(
      (conversation) => conversation.kind === "direct" && getOtherParticipant(conversation, user._id)?._id === targetUserId
    );

    if (existingConversation) {
      handleSelectConversation(existingConversation._id);
      return;
    }

    try {
      const response = await apiClient.post(`/chats/direct/${targetUserId}`);
      setConversations((current) => upsertConversation(current, response.data));
      handleSelectConversation(response.data._id);
    } catch (requestError) {
      setError(getRequestMessage(requestError, "Unable to start this chat."));
    }
  };

  const handleSendMessage = async () => {
    if (!activeConversationId || (!composerText.trim() && !pendingAttachment)) {
      return;
    }

    setIsSendingMessage(true);

    try {
      const payload = new FormData();
      payload.append("text", composerText.trim());

      if (pendingAttachment) {
        payload.append("attachment", {
          name: pendingAttachment.name,
          type: pendingAttachment.mimeType,
          uri: pendingAttachment.uri
        });
      }

      const response = await apiClient.post(`/chats/${activeConversationId}/messages`, payload, {
        headers: {
          "Content-Type": "multipart/form-data"
        }
      });

      setComposerText("");
      setPendingAttachment(null);
      setConversations((current) => upsertConversation(current, response.data.conversation));
      setMessages((current) => upsertMessage(current, response.data.message));
    } catch (requestError) {
      setError(getRequestMessage(requestError, "Unable to send message."));
    } finally {
      setIsSendingMessage(false);
    }
  };

  const handleDeleteForEveryone = async () => {
    if (!selectedMessage || !activeConversationId) {
      return;
    }

    try {
      await apiClient.delete(`/chats/${activeConversationId}/messages/${selectedMessage._id}`);
      showNotice("Message deleted for everyone.");
      setSelectedMessage(null);
    } catch (requestError) {
      setError(getRequestMessage(requestError, "Unable to delete the message."));
    }
  };

  const handleDeleteForSelf = async () => {
    if (!selectedMessage || !activeConversationId) {
      return;
    }

    setHiddenMessageMap((current) => ({
      ...current,
      [activeConversationId]: Array.from(new Set([...(current[activeConversationId] || []), selectedMessage._id]))
    }));
    showNotice("Message deleted for you.");
    setSelectedMessage(null);
  };

  const handleCopyMessage = async () => {
    if (!selectedMessage) {
      return;
    }

    const value =
      selectedMessage.text?.trim() ||
      selectedMessage.attachments?.map((attachment) => attachment.originalName || attachment.kind).join(", ") ||
      "Message";

    await Clipboard.setStringAsync(value);
    showNotice("Message copied.");
    setSelectedMessage(null);
  };

  const handleShareMessage = async () => {
    if (!selectedMessage) {
      return;
    }

    const value =
      selectedMessage.text?.trim() ||
      selectedMessage.attachments?.map((attachment) => attachment.originalName || attachment.kind).join(", ") ||
      "Message";

    try {
      await Share.share({ message: value });
      showNotice("Message ready to share.");
    } catch {
      setError("Share action cancel ho gaya ya available nahi tha.");
    } finally {
      setSelectedMessage(null);
    }
  };

  const handleDeleteChat = () => {
    if (!activeConversationId) {
      return;
    }

    Alert.alert("Delete chat", "Ye poori conversation remove ho jayegi. Continue?", [
      { style: "cancel", text: "Cancel" },
      {
        style: "destructive",
        text: "Delete",
        onPress: async () => {
          try {
            await apiClient.delete(`/chats/${activeConversationId}`);
            setConversations((current) => removeConversation(current, activeConversationId));
            setMessages([]);
            setActiveConversationId(null);
            showNotice("Chat deleted.");
          } catch (requestError) {
            setError(getRequestMessage(requestError, "Unable to delete chat."));
          }
        }
      }
    ]);
  };

  const patchRelationshipState = (targetUserId, isBlocked) => {
    setContacts((current) =>
      current.map((contact) => (contact._id === targetUserId ? { ...contact, isBlocked } : contact))
    );
    setConversations((current) =>
      current.map((conversation) => ({
        ...conversation,
        participants: conversation.participants.map((participant) =>
          participant._id === targetUserId ? { ...participant, isBlocked } : participant
        )
      }))
    );
  };

  const handleSaveProfile = async () => {
    try {
      const response = await apiClient.patch("/users/me", {
        about: profileForm.about,
        name: profileForm.name
      });

      await setCurrentUser(response.data.user);
      showNotice("Profile updated.");
    } catch (requestError) {
      setError(getRequestMessage(requestError, "Unable to update profile."));
    }
  };

  const handleChangePassword = async () => {
    try {
      await apiClient.post("/auth/change-password", changePasswordForm);
      setChangePasswordForm({
        currentPassword: "",
        newPassword: ""
      });
      showNotice("Password updated.");
    } catch (requestError) {
      setError(getRequestMessage(requestError, "Unable to change password."));
    }
  };

  const handleUnblock = async (userId) => {
    try {
      const response = await apiClient.delete(`/users/${userId}/block`);
      blockedUsersLoadedRef.current = true;
      setBlockedUsers(response.data.blockedUsers);
      await setCurrentUser(response.data.user);
      setConversations((current) =>
        current.map((conversation) => ({
          ...conversation,
          participants: conversation.participants.map((participant) =>
            participant._id === userId ? { ...participant, isBlocked: false } : participant
          )
        }))
      );
      setContacts((current) =>
        current.map((contact) => (contact._id === userId ? { ...contact, isBlocked: false } : contact))
      );
      showNotice("User unblocked.");
    } catch (requestError) {
      setError(getRequestMessage(requestError, "Unable to unblock user."));
    }
  };

  const handleBlockToggle = async () => {
    const directUser = activeConversation && activeConversation.kind === "direct" ? getOtherParticipant(activeConversation, user._id) : null;

    if (!directUser?._id) {
      showNotice("Direct chat par hi block control available hai.");
      return;
    }

    try {
      if (directUser.isBlocked) {
        const response = await apiClient.delete(`/users/${directUser._id}/block`);
        blockedUsersLoadedRef.current = true;
        setBlockedUsers(response.data.blockedUsers);
        await setCurrentUser(response.data.user);
        patchRelationshipState(directUser._id, false);
        showNotice("User unblocked.");
      } else {
        const response = await apiClient.post(`/users/${directUser._id}/block`);
        blockedUsersLoadedRef.current = true;
        setBlockedUsers(response.data.blockedUsers);
        await setCurrentUser(response.data.user);
        patchRelationshipState(directUser._id, true);
        showNotice(`${directUser.name} blocked.`);
      }
    } catch (requestError) {
      setError(getRequestMessage(requestError, "Unable to update block status."));
    }
  };

  const handleChatInfoAction = (action) => {
    if (!activeConversation) {
      return;
    }

    if (action === "search") {
      setChatSearchVisible(true);
      setIsChatInfoVisible(false);
      showNotice("Chat search opened.");
      return;
    }

    if (action === "storage") {
      const mediaItems = messages.flatMap((message) =>
        (message.attachments || []).map((attachment) => ({
          ...attachment,
          messageId: message._id
        }))
      );
      const totalBytes = mediaItems.reduce((sum, item) => sum + (item.size || 0), 0);
      Alert.alert("Manage storage", `${mediaItems.length} media/doc item(s)\n${formatBytes(totalBytes)} used in this chat.`);
      return;
    }

    if (action === "groups") {
      showNotice("Create group flow next step me aur strong banayenge.");
      return;
    }

    if (action === "report") {
      setIsChatInfoVisible(false);
      showNotice("Report noted. Review queue ke liye mark kar diya.");
      return;
    }
  };

  const startCall = async (type, conversationId = activeConversationId) => {
    const currentConversation = conversations.find((conversation) => conversation._id === conversationId);

    if (!currentConversation || currentConversation.kind === "group") {
      setError("Audio aur video call abhi direct chats ke liye available hai.");
      return;
    }

    const partner = getOtherParticipant(currentConversation, user._id);

    if (!partner?._id) {
      setError("Call partner unavailable hai.");
      return;
    }

    try {
      const stream = await getUserMediaStream(type);
      const peerConnection = createPeerConnection(partner._id);

      stream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, stream);
      });

      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      socketRef.current?.emit("call:offer", {
        callType: type,
        conversationId,
        sdp: offer,
        toUserId: partner._id
      });

      setCallState({
        connectedAt: null,
        conversationId,
        direction: "outgoing",
        isMicMuted: false,
        isSpeakerOn: type === "video",
        isVideoEnabled: type === "video",
        open: true,
        partner,
        phase: "outgoing",
        startedAt: new Date().toISOString(),
        status: `Calling ${partner.name}...`,
        type
      });
    } catch (requestError) {
      resetCallMedia();
      setError(getRequestMessage(requestError, "Unable to start the call."));
    }
  };

  const handleAnswerCall = async () => {
    try {
      const stream = await getUserMediaStream(callState.type);
      const peerConnection = createPeerConnection(callState.partner._id);

      stream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, stream);
      });

      await peerConnection.setRemoteDescription(new RTCSessionDescription(incomingOfferRef.current));
      await flushPendingIceCandidates();
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);

      socketRef.current?.emit("call:answer", {
        sdp: answer,
        toUserId: callState.partner._id
      });

      setCallState((current) => ({
        ...current,
        connectedAt: new Date().toISOString(),
        phase: "active",
        status: "Call connected"
      }));
    } catch (requestError) {
      endCallSession({ emitDecline: true, emitEnd: false, reason: "declined" });
      setError(getRequestMessage(requestError, "Unable to answer the call."));
    }
  };

  const handleToggleMic = () => {
    const audioTrack = localStreamRef.current?.getAudioTracks?.()?.[0];

    if (!audioTrack) {
      return;
    }

    const nextEnabled = !audioTrack.enabled;
    audioTrack.enabled = nextEnabled;
    setCallState((current) => ({
      ...current,
      isMicMuted: !nextEnabled
    }));
  };

  const handleToggleVideo = () => {
    const videoTrack = localStreamRef.current?.getVideoTracks?.()?.[0];

    if (!videoTrack) {
      return;
    }

    const nextEnabled = !videoTrack.enabled;
    videoTrack.enabled = nextEnabled;
    setCallState((current) => ({
      ...current,
      isVideoEnabled: nextEnabled
    }));
  };

  const handleToggleSpeaker = () => {
    setCallState((current) => {
      const nextSpeakerState = !current.isSpeakerOn;
      applySpeakerRoute(nextSpeakerState);

      return {
        ...current,
        isSpeakerOn: nextSpeakerState
      };
    });
  };

  if (!user?._id) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.centeredCard}>
          <ActivityIndicator color={theme.accent} size="large" />
          <Text style={styles.centeredTitle}>Signing you in</Text>
          <Text style={styles.centeredCopy}>Session restore aur profile sync complete ho raha hai.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const activeConversation = conversations.find((conversation) => conversation._id === activeConversationId) || null;
  const activeConversationUser =
    activeConversation && activeConversation.kind === "direct" ? getOtherParticipant(activeConversation, user._id) : null;
  const activeConversationPrefs = activeConversation ? getConversationPreferences(activeConversation._id) : defaultConversationPrefs;
  const hiddenMessageIds = activeConversationId ? hiddenMessageMap[activeConversationId] || [] : [];
  const visibleMessages = messages.filter((message) => !hiddenMessageIds.includes(message._id));
  const filteredChatMessages = visibleMessages.filter((message) => {
    const query = chatSearchQuery.trim().toLowerCase();

    if (!query) {
      return true;
    }

    const searchableValue = [
      message.text || "",
      ...(message.attachments || []).map((attachment) => `${attachment.originalName || ""} ${attachment.kind || ""}`)
    ]
      .join(" ")
      .toLowerCase();

    return searchableValue.includes(query);
  });
  const filteredConversations = conversations.filter((conversation) => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) {
      return true;
    }

    const title = getConversationTitle(conversation, user._id).toLowerCase();
    const preview = (conversation.lastMessagePreview || "").toLowerCase();
    return title.includes(query) || preview.includes(query);
  });
  const suggestedContacts = contacts.filter((contact) => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) {
      return false;
    }

    return (
      !filteredConversations.some(
        (conversation) => conversation.kind === "direct" && getOtherParticipant(conversation, user._id)?._id === contact._id
      ) &&
      (contact.name.toLowerCase().includes(query) || contact.email.toLowerCase().includes(query))
    );
  });
  const chatListConversations = filteredConversations.filter((conversation) =>
    tabFilter === "unread" ? Boolean(unreadMap[conversation._id]) : true
  );
  const communityConversations = conversations.filter((conversation) => conversation.kind === "group");
  const lockedConversationCount = conversations.filter((conversation) => getConversationPreferences(conversation._id).locked).length;
  const unreadConversationCount = conversations.filter((conversation) => Boolean(unreadMap[conversation._id])).length;
  const chatMediaItems = visibleMessages.flatMap((message) =>
    (message.attachments || []).map((attachment) => ({
      ...attachment,
      messageId: message._id
    }))
  );
  const chatStorageBytes = chatMediaItems.reduce((sum, attachment) => sum + (attachment.size || 0), 0);
  const hiddenMessagesTotal = Object.values(hiddenMessageMap).reduce((sum, ids) => sum + ids.length, 0);
  const canDeleteForEveryone = selectedMessage?.sender?._id === user._id && !selectedMessage?.isDeleted;
  const composerDisabled =
    isSendingMessage || isLoadingMessages || (activeConversation && isConversationRestricted(activeConversation, user._id));

  if (isPageLoading) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.centeredCard}>
          <ActivityIndicator color={theme.accent} size="large" />
          <Text style={styles.centeredTitle}>Preparing PulseChat Mobile</Text>
          <Text style={styles.centeredCopy}>Chats load ho rahe hain. Baaki tabs background me sync honge.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      {notice ? (
        <View style={styles.noticeChip}>
          <Text style={styles.noticeCopy}>{notice}</Text>
        </View>
      ) : null}

      {error ? (
        <View style={styles.errorChip}>
          <Text style={styles.errorCopy}>{error}</Text>
        </View>
      ) : null}

      {activeConversation && activeTab === "chats" ? (
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
          <View style={styles.chatHeader}>
            <Pressable
              onPress={() => {
                setActiveConversationId(null);
                setChatSearchVisible(false);
                setChatSearchQuery("");
              }}
              style={styles.headerIconButton}
            >
              <Ionicons color={theme.text} name="arrow-back" size={22} />
            </Pressable>

            <Pressable onPress={() => setIsChatInfoVisible(true)} style={styles.headerIdentity}>
              <AvatarBadge size={42} user={getConversationAvatar(activeConversation, user._id)} />
              <View style={styles.headerIdentityCopy}>
                <Text numberOfLines={1} style={styles.headerTitle}>
                  {getConversationTitle(activeConversation, user._id)}
                </Text>
                <Text numberOfLines={1} style={styles.headerSubtitle}>
                  {uiPrefs.showLastSeen
                    ? getConversationSubtitle(activeConversation, user._id)
                    : activeConversation?.kind === "group"
                      ? `${activeConversation.participants?.length || 0} members`
                      : "Private profile"}
                </Text>
              </View>
            </Pressable>

            <View style={styles.headerButtons}>
              <Pressable onPress={() => startCall("video")} style={styles.headerIconButton}>
                <Ionicons color={theme.text} name="videocam-outline" size={21} />
              </Pressable>
              <Pressable onPress={() => startCall("audio")} style={styles.headerIconButton}>
                <Ionicons color={theme.text} name="call-outline" size={20} />
              </Pressable>
              <Pressable onPress={() => setIsChatInfoVisible(true)} style={styles.headerIconButton}>
                <MaterialCommunityIcons color={theme.text} name="dots-vertical" size={22} />
              </Pressable>
            </View>
          </View>

          {chatSearchVisible ? (
            <View style={styles.chatSearchShell}>
              <Feather color={theme.muted} name="search" size={18} />
              <TextInput
                onChangeText={setChatSearchQuery}
                placeholder="Search in chat"
                placeholderTextColor={theme.muted}
                style={styles.chatSearchInput}
                value={chatSearchQuery}
              />
              <Pressable
                onPress={() => {
                  setChatSearchVisible(false);
                  setChatSearchQuery("");
                }}
                style={styles.chatSearchClose}
              >
                <Ionicons color={theme.muted} name="close" size={20} />
              </Pressable>
            </View>
          ) : null}

          <ScrollView
            contentContainerStyle={styles.chatScrollContent}
            ref={chatScrollRef}
            showsVerticalScrollIndicator={false}
            style={styles.chatScroll}
          >
            {isLoadingMessages ? (
              <View style={styles.centeredInline}>
                <ActivityIndicator color={theme.accent} />
                <Text style={styles.inlineMuted}>Loading messages...</Text>
              </View>
            ) : filteredChatMessages.length ? (
              filteredChatMessages.map((message, index) => {
                const isOwnMessage = message.sender?._id === user._id;
                const dayLabel = formatMessageDay(message.createdAt);
                const previousDayLabel = index > 0 ? formatMessageDay(filteredChatMessages[index - 1].createdAt) : "";
                const attachment = message.attachments?.[0] || null;

                return (
                  <View key={message._id}>
                    {index === 0 || previousDayLabel !== dayLabel ? (
                      <View style={styles.dayChipShell}>
                        <Text style={styles.dayChipCopy}>{dayLabel}</Text>
                      </View>
                    ) : null}

                    <View style={[styles.messageRow, isOwnMessage ? styles.messageRowOwn : null]}>
                      <Pressable
                        onLongPress={() => setSelectedMessage(message)}
                        style={[
                          styles.messageBubble,
                          { backgroundColor: isOwnMessage ? theme.bubbleOutgoing : theme.bubbleIncoming },
                          isOwnMessage ? styles.messageBubbleOwn : styles.messageBubbleIncoming
                        ]}
                      >
                        {message.isDeleted ? <Text style={styles.deletedCopy}>This message was deleted.</Text> : null}
                        {!message.isDeleted && message.text ? <Text style={styles.messageCopy}>{message.text}</Text> : null}

                        {!message.isDeleted && attachment ? (
                          attachment.kind === "image" ? (
                            <Pressable onPress={() => void openAttachmentUrl(attachment)}>
                              <Image source={{ uri: resolveAssetUrl(attachment.url) }} style={styles.messageImage} />
                            </Pressable>
                          ) : (
                            <Pressable onPress={() => void openAttachmentUrl(attachment)} style={styles.attachmentCard}>
                              <View style={styles.attachmentHeader}>
                                <MaterialCommunityIcons
                                  color={theme.accent}
                                  name={
                                    attachment.kind === "video"
                                      ? "play-circle-outline"
                                      : attachment.kind === "audio"
                                        ? "waveform"
                                        : "file-document-outline"
                                  }
                                  size={22}
                                />
                                <Text style={styles.attachmentTitle}>{attachment.originalName || attachment.kind}</Text>
                              </View>
                              <Text style={styles.attachmentMeta}>
                                {attachment.kind} · {formatBytes(attachment.size)}
                              </Text>
                            </Pressable>
                          )
                        ) : null}

                        <Text style={styles.messageTime}>{formatMessageTime(message.createdAt)}</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>Say hello</Text>
                <Text style={styles.emptyCopy}>Ye React Native chat screen realtime messages ke liye ready hai.</Text>
              </View>
            )}
          </ScrollView>

          {pendingAttachment ? (
            <View style={styles.pendingAttachment}>
              {pendingAttachment.kind === "image" ? (
                <Image source={{ uri: pendingAttachment.uri }} style={styles.pendingAttachmentPreview} />
              ) : (
                <View style={styles.pendingAttachmentIconShell}>
                  <MaterialCommunityIcons
                    color={theme.accent}
                    name={
                      pendingAttachment.kind === "video"
                        ? "play-box-outline"
                        : pendingAttachment.kind === "audio"
                          ? "waveform"
                          : "file-document-outline"
                    }
                    size={24}
                  />
                </View>
              )}
              <View style={styles.pendingAttachmentCopy}>
                <Text numberOfLines={1} style={styles.pendingAttachmentTitle}>
                  {pendingAttachment.name}
                </Text>
                <Text style={styles.pendingAttachmentMeta}>
                  {pendingAttachment.kind} - {formatBytes(pendingAttachment.size)}
                </Text>
              </View>
              <Pressable onPress={() => setPendingAttachment(null)} style={styles.pendingAttachmentRemove}>
                <Ionicons color={theme.muted} name="close" size={20} />
              </Pressable>
            </View>
          ) : null}

          <View style={styles.composer}>
            <Pressable onPress={openAttachmentPicker} style={styles.composerAccessory}>
              <Feather color={theme.muted} name="paperclip" size={18} />
            </Pressable>
            <TextInput
              editable={!composerDisabled}
              multiline
              onChangeText={setComposerText}
              placeholder="Message"
              placeholderTextColor={theme.muted}
              style={styles.composerInput}
              value={composerText}
            />
            <Pressable onPress={() => void pickFromCamera()} style={styles.composerAccessory}>
              <Ionicons color={theme.muted} name="camera-outline" size={20} />
            </Pressable>
            <Pressable disabled={composerDisabled} onPress={handleSendMessage} style={styles.sendButton}>
              <Text style={styles.sendButtonCopy}>{isSendingMessage ? "..." : "Send"}</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      ) : (
        <>
          <View style={styles.topbar}>
            <Text style={styles.topbarTitle}>PulseChat</Text>

            <View style={styles.topbarActions}>
              <Pressable onPress={() => void pickFromCamera()} style={styles.topbarIconButton}>
                <Ionicons color={theme.text} name="camera-outline" size={22} />
              </Pressable>
              <Pressable onPress={() => setIsMenuVisible(true)} style={styles.topbarIconButton}>
                <MaterialCommunityIcons color={theme.text} name="dots-vertical" size={22} />
              </Pressable>
            </View>
          </View>

          <View style={styles.searchShell}>
            <View style={styles.searchField}>
              <Feather color={theme.muted} name="search" size={20} />
              <TextInput
                onChangeText={setSearchQuery}
                placeholder="Ask Meta AI or Search"
                placeholderTextColor={theme.muted}
                style={styles.searchInput}
                value={searchQuery}
              />
            </View>
          </View>

          <ScrollView contentContainerStyle={styles.tabContent} showsVerticalScrollIndicator={false}>
            {activeTab === "chats" ? (
              <>
                <View style={styles.filterRow}>
                  <Pressable
                    onPress={() => setTabFilter("all")}
                    style={[styles.filterChip, tabFilter === "all" ? styles.filterChipActive : null]}
                  >
                    <Text style={[styles.filterChipCopy, tabFilter === "all" ? styles.filterChipCopyActive : null]}>All</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setTabFilter("unread")}
                    style={[styles.filterChip, tabFilter === "unread" ? styles.filterChipActive : null]}
                  >
                    <Text style={[styles.filterChipCopy, tabFilter === "unread" ? styles.filterChipCopyActive : null]}>
                      Unread {unreadConversationCount ? unreadConversationCount : ""}
                    </Text>
                  </Pressable>
                  <View style={styles.filterSpacer} />
                  <View style={styles.filterRoundButton}>
                    <MaterialCommunityIcons color={theme.muted} name="tune-variant" size={18} />
                  </View>
                </View>

                <View style={styles.lockedRow}>
                  <MaterialCommunityIcons color={theme.muted} name="lock-outline" size={20} />
                  <Text style={styles.lockedRowCopy}>Locked chats</Text>
                  <Text style={styles.lockedRowCount}>{lockedConversationCount}</Text>
                </View>

                {chatListConversations.length ? (
                  chatListConversations.map((conversation) => {
                    const avatar = getConversationAvatar(conversation, user._id);
                    const otherUser = conversation.kind === "direct" ? getOtherParticipant(conversation, user._id) : null;

                    return (
                      <Pressable key={conversation._id} onPress={() => handleSelectConversation(conversation._id)} style={styles.listCardCompact}>
                        <AvatarBadge size={54} user={avatar} />
                        <View style={styles.listCopy}>
                          <View style={styles.listTopline}>
                            <Text numberOfLines={1} style={styles.listTitle}>
                              {getConversationTitle(conversation, user._id)}
                            </Text>
                            <Text style={styles.listTime}>{formatSidebarTime(conversation.lastMessageAt)}</Text>
                          </View>
                          <Text numberOfLines={1} style={styles.listSubtitle}>
                            {conversation.lastMessagePreview ||
                              (uiPrefs.showLastSeen
                                ? getConversationSubtitle(conversation, user._id)
                                : conversation.kind === "group"
                                  ? `${conversation.participants?.length || 0} members`
                                  : otherUser?.about || "Tap to chat")}
                          </Text>
                          {otherUser?.isOnline ? <Text style={styles.listStatus}>Online</Text> : null}
                        </View>
                        {unreadMap[conversation._id] ? (
                          <View style={styles.unreadBadge}>
                            <Text style={styles.unreadCopy}>{unreadMap[conversation._id]}</Text>
                          </View>
                        ) : null}
                      </Pressable>
                    );
                  })
                ) : (
                  <View style={styles.emptyCard}>
                    <Text style={styles.emptyTitle}>No chats yet</Text>
                    <Text style={styles.emptyCopy}>Jaise hi conversations sync hongi, yahan WhatsApp-style list dikhne lagegi.</Text>
                  </View>
                )}
              </>
            ) : null}

            {activeTab === "updates" ? (
              <>
                <Text style={styles.sectionTitle}>Updates</Text>
                {stories.length ? (
                  stories.map((storyGroup) => (
                    <View key={storyGroup.author._id} style={styles.listCardCompact}>
                      <AvatarBadge size={52} user={storyGroup.author} />
                      <View style={styles.listCopy}>
                        <Text style={styles.listTitle}>{storyGroup.author.name}</Text>
                        <Text numberOfLines={1} style={styles.listSubtitle}>
                          {storyGroup.stories?.[0]?.caption || storyGroup.stories?.[0]?.text || "Status update"}
                        </Text>
                      </View>
                      <Text style={styles.listTime}>{formatStoryTime(storyGroup.stories?.[0]?.createdAt)}</Text>
                    </View>
                  ))
                ) : (
                  <View style={styles.emptyCard}>
                    <Text style={styles.emptyTitle}>No status updates</Text>
                    <Text style={styles.emptyCopy}>Updates tab backend stories ke saath connected hai. Story composer ko next pass me aur strong bana denge.</Text>
                  </View>
                )}
              </>
            ) : null}

            {activeTab === "communities" ? (
              <>
                <Text style={styles.sectionTitle}>Communities</Text>

                {communityConversations.length ? (
                  communityConversations.map((conversation) => (
                    <View key={conversation._id} style={styles.listCardCompact}>
                      <AvatarBadge size={52} user={getConversationAvatar(conversation, user._id)} />
                      <View style={styles.listCopy}>
                        <Text style={styles.listTitle}>{getConversationTitle(conversation, user._id)}</Text>
                        <Text style={styles.listSubtitle}>
                          {conversation.groupDescription || `${conversation.participants?.length || 0} members`}
                        </Text>
                      </View>
                      <MaterialCommunityIcons color={theme.accent} name="account-group-outline" size={20} />
                    </View>
                  ))
                ) : (
                  <View style={styles.emptyCard}>
                    <Text style={styles.emptyTitle}>No communities yet</Text>
                    <Text style={styles.emptyCopy}>Group conversations yahan aayengi. Create-group flow ko next pass me aur strong bana sakte hain.</Text>
                  </View>
                )}
              </>
            ) : null}

            {activeTab === "calls" ? (
              <>
                <Text style={styles.sectionTitle}>Calls</Text>
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyTitle}>Native call layer next</Text>
                  <Text style={styles.emptyCopy}>
                    React Native app ka chat, auth, settings, status aur realtime sync ready hai. Voice/video calls ko native WebRTC package ke saath next phase me wire karna hoga.
                  </Text>
                </View>

                {conversations
                  .filter((conversation) => conversation.kind === "direct")
                  .map((conversation) => (
                    <View key={conversation._id} style={styles.listCardCompact}>
                      <AvatarBadge size={50} user={getConversationAvatar(conversation, user._id)} />
                      <View style={styles.listCopy}>
                        <Text style={styles.listTitle}>{getConversationTitle(conversation, user._id)}</Text>
                        <Text style={styles.listSubtitle}>{getConversationSubtitle(conversation, user._id)}</Text>
                      </View>
                      <View style={styles.callActions}>
                        <Pressable onPress={() => startCall("audio", conversation._id)} style={styles.callActionButton}>
                          <Ionicons color={theme.accent} name="call-outline" size={18} />
                        </Pressable>
                        <Pressable onPress={() => startCall("video", conversation._id)} style={styles.callActionButton}>
                          <Ionicons color={theme.accent} name="videocam-outline" size={18} />
                        </Pressable>
                      </View>
                    </View>
                  ))}
              </>
            ) : null}
          </ScrollView>

          <View style={styles.tabbar}>
            {[
              ["chats", "Chats", "chat-outline"],
              ["updates", "Updates", "update"],
              ["communities", "Communities", "account-group-outline"],
              ["calls", "Calls", "phone-outline"]
            ].map(([key, label]) => (
              <Pressable
                key={key}
                onPress={() => {
                  setActiveTab(key);
                  setActiveConversationId(null);
                }}
                style={[styles.tabButton, activeTab === key ? styles.tabButtonActive : null]}
              >
                <MaterialCommunityIcons
                  color={activeTab === key ? theme.accent : theme.muted}
                  name={key === "updates" ? "progress-clock" : key === "calls" ? "phone-outline" : key === "communities" ? "account-group-outline" : "chat-outline"}
                  size={22}
                />
                <Text style={[styles.tabButtonCopy, activeTab === key ? styles.tabButtonCopyActive : null]}>{label}</Text>
              </Pressable>
            ))}
          </View>
        </>
      )}

      <Modal animationType="fade" onRequestClose={() => setIsMenuVisible(false)} transparent visible={isMenuVisible}>
        <Pressable onPress={() => setIsMenuVisible(false)} style={[styles.modalBackdrop, { backgroundColor: theme.overlay }]}>
          <View />
        </Pressable>
        <View style={[styles.popupMenu, { backgroundColor: theme.panel, borderColor: theme.border }]}>
          <Pressable onPress={() => openSettingsSection("root")} style={styles.popupMenuItem}>
            <Text style={styles.popupMenuCopy}>Settings</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              toggleTheme();
              setIsMenuVisible(false);
            }}
            style={styles.popupMenuItem}
          >
            <Text style={styles.popupMenuCopy}>{themeName === "dark" ? "Light mode" : "Dark mode"}</Text>
          </Pressable>
          <Pressable
            onPress={async () => {
              setIsMenuVisible(false);
              await logout();
            }}
            style={styles.popupMenuItem}
          >
            <Text style={[styles.popupMenuCopy, { color: theme.danger }]}>Logout</Text>
          </Pressable>
        </View>
      </Modal>

      <Modal animationType="slide" onRequestClose={closeSettings} visible={isSettingsVisible}>
        <SafeAreaView style={styles.screen}>
          <View style={styles.modalHeader}>
            <Pressable
              onPress={() => {
                if (settingsSection === "root") {
                  closeSettings();
                } else {
                  setSettingsSection("root");
                }
              }}
              style={styles.headerIconButton}
            >
              <Ionicons color={theme.text} name="arrow-back" size={22} />
            </Pressable>
            <Text style={styles.modalHeaderTitle}>
              {{
                root: "Settings",
                account: "Account",
                privacy: "Privacy",
                chats: "Chats",
                storage: "Storage and data",
                help: "Help"
              }[settingsSection]}
            </Text>
            <View style={styles.headerIconButton} />
          </View>

          <ScrollView contentContainerStyle={styles.modalScroll}>
            {settingsSection === "root" ? (
              <View style={styles.settingsCard}>
                {[
                  ["account", "Account", "Manage profile, password and logout", "account-circle-outline"],
                  ["privacy", "Privacy", "Blocked users, last seen and read receipts", "shield-lock-outline"],
                  ["chats", "Chats", "Theme and chat preferences", "chat-processing-outline"],
                  ["storage", "Storage and data", "Media usage and local cleanup", "harddisk"],
                  ["help", "Help", "App details and support guidance", "help-circle-outline"]
                ].map(([key, title, subtitle, icon]) => (
                  <Pressable key={key} onPress={() => setSettingsSection(key)} style={styles.settingsRow}>
                    <MaterialCommunityIcons color={theme.accent} name={icon} size={22} />
                    <View style={styles.settingsRowCopy}>
                      <Text style={styles.settingsRowTitle}>{title}</Text>
                      <Text style={styles.settingsRowSubtitle}>{subtitle}</Text>
                    </View>
                    <Ionicons color={theme.muted} name="chevron-forward" size={18} />
                  </Pressable>
                ))}
              </View>
            ) : null}

            {settingsSection === "account" ? (
              <>
                <View style={styles.settingsCard}>
                  <Text style={styles.cardTitle}>Profile</Text>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Name</Text>
                    <TextInput
                      onChangeText={(value) => setProfileForm((current) => ({ ...current, name: value }))}
                      placeholder="Your name"
                      placeholderTextColor={theme.muted}
                      style={styles.input}
                      value={profileForm.name}
                    />
                  </View>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>About</Text>
                    <TextInput
                      onChangeText={(value) => setProfileForm((current) => ({ ...current, about: value }))}
                      placeholder="About"
                      placeholderTextColor={theme.muted}
                      style={styles.input}
                      value={profileForm.about}
                    />
                  </View>
                  <Pressable onPress={handleSaveProfile} style={styles.primaryButton}>
                    <Text style={styles.primaryButtonCopy}>Save profile</Text>
                  </Pressable>
                </View>

                <View style={styles.settingsCard}>
                  <Text style={styles.cardTitle}>Change password</Text>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Current password</Text>
                    <TextInput
                      onChangeText={(value) => setChangePasswordForm((current) => ({ ...current, currentPassword: value }))}
                      placeholder="Current password"
                      placeholderTextColor={theme.muted}
                      secureTextEntry
                      style={styles.input}
                      value={changePasswordForm.currentPassword}
                    />
                  </View>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>New password</Text>
                    <TextInput
                      onChangeText={(value) => setChangePasswordForm((current) => ({ ...current, newPassword: value }))}
                      placeholder="New password"
                      placeholderTextColor={theme.muted}
                      secureTextEntry
                      style={styles.input}
                      value={changePasswordForm.newPassword}
                    />
                  </View>
                  <Pressable onPress={handleChangePassword} style={styles.primaryButton}>
                    <Text style={styles.primaryButtonCopy}>Update password</Text>
                  </Pressable>
                  <Pressable
                    onPress={async () => {
                      closeSettings();
                      await logout();
                    }}
                    style={styles.secondaryButton}
                  >
                    <Text style={[styles.secondaryButtonCopy, { color: theme.danger }]}>Logout</Text>
                  </Pressable>
                </View>
              </>
            ) : null}

            {settingsSection === "privacy" ? (
              <>
                <View style={styles.settingsCard}>
                  <Text style={styles.cardTitle}>Privacy controls</Text>
                  <View style={styles.toggleRow}>
                    <View style={styles.settingsRowCopy}>
                      <Text style={styles.settingsRowTitle}>Show last seen</Text>
                      <Text style={styles.settingsRowSubtitle}>Chat subtitle me last seen visibility control</Text>
                    </View>
                    <Switch
                      onValueChange={(value) => updateUiPreference("showLastSeen", value)}
                      thumbColor={uiPrefs.showLastSeen ? theme.accent : theme.muted}
                      trackColor={{ false: theme.panelSoft, true: theme.accentSoft }}
                      value={uiPrefs.showLastSeen}
                    />
                  </View>
                  <View style={styles.toggleRow}>
                    <View style={styles.settingsRowCopy}>
                      <Text style={styles.settingsRowTitle}>Read receipts</Text>
                      <Text style={styles.settingsRowSubtitle}>Local privacy preference</Text>
                    </View>
                    <Switch
                      onValueChange={(value) => updateUiPreference("readReceipts", value)}
                      thumbColor={uiPrefs.readReceipts ? theme.accent : theme.muted}
                      trackColor={{ false: theme.panelSoft, true: theme.accentSoft }}
                      value={uiPrefs.readReceipts}
                    />
                  </View>
                </View>

                <View style={styles.settingsCard}>
                  <Text style={styles.cardTitle}>Blocked users</Text>
                  {blockedUsers.length ? (
                    blockedUsers.map((blockedUser) => (
                      <View key={blockedUser._id} style={styles.blockedRow}>
                        <AvatarBadge size={40} user={blockedUser} />
                        <View style={styles.listCopy}>
                          <Text style={styles.listTitle}>{blockedUser.name}</Text>
                          <Text style={styles.listSubtitle}>{blockedUser.email}</Text>
                        </View>
                        <Pressable onPress={() => handleUnblock(blockedUser._id)} style={styles.inlineAction}>
                          <Text style={styles.inlineActionCopy}>Unblock</Text>
                        </Pressable>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.inlineMuted}>No blocked users right now.</Text>
                  )}
                </View>
              </>
            ) : null}

            {settingsSection === "chats" ? (
              <View style={styles.settingsCard}>
                <Text style={styles.cardTitle}>Chat preferences</Text>
                <View style={styles.toggleRow}>
                  <View style={styles.settingsRowCopy}>
                    <Text style={styles.settingsRowTitle}>Dark mode</Text>
                    <Text style={styles.settingsRowSubtitle}>Switch app look between dark and light</Text>
                  </View>
                  <Switch
                    onValueChange={() => toggleTheme()}
                    thumbColor={theme.mode === "dark" ? theme.accent : theme.muted}
                    trackColor={{ false: theme.panelSoft, true: theme.accentSoft }}
                    value={theme.mode === "dark"}
                  />
                </View>
                <View style={styles.toggleRow}>
                  <View style={styles.settingsRowCopy}>
                    <Text style={styles.settingsRowTitle}>Media auto-download</Text>
                    <Text style={styles.settingsRowSubtitle}>Reduce mobile data usage when needed</Text>
                  </View>
                  <Switch
                    onValueChange={(value) => updateUiPreference("mediaAutoDownload", value)}
                    thumbColor={uiPrefs.mediaAutoDownload ? theme.accent : theme.muted}
                    trackColor={{ false: theme.panelSoft, true: theme.accentSoft }}
                    value={uiPrefs.mediaAutoDownload}
                  />
                </View>
                <Text style={styles.inlineMuted}>Search-only home layout active hai, contacts suggestions hidden hain.</Text>
              </View>
            ) : null}

            {settingsSection === "storage" ? (
              <View style={styles.settingsCard}>
                <Text style={styles.cardTitle}>Storage and data</Text>
                <View style={styles.metricRow}>
                  <Text style={styles.settingsRowTitle}>Chats loaded</Text>
                  <Text style={styles.metricValue}>{conversations.length}</Text>
                </View>
                <View style={styles.metricRow}>
                  <Text style={styles.settingsRowTitle}>Group chats</Text>
                  <Text style={styles.metricValue}>{communityConversations.length}</Text>
                </View>
                <View style={styles.metricRow}>
                  <Text style={styles.settingsRowTitle}>Hidden messages</Text>
                  <Text style={styles.metricValue}>{hiddenMessagesTotal}</Text>
                </View>
                <View style={styles.metricRow}>
                  <Text style={styles.settingsRowTitle}>Current chat media size</Text>
                  <Text style={styles.metricValue}>{formatBytes(chatStorageBytes)}</Text>
                </View>
                <Pressable
                  onPress={() => {
                    setHiddenMessageMap({});
                    showNotice("Local hidden messages cleared.");
                  }}
                  style={styles.secondaryButton}
                >
                  <Text style={styles.secondaryButtonCopy}>Clear hidden messages</Text>
                </Pressable>
              </View>
            ) : null}

            {settingsSection === "help" ? (
              <View style={styles.settingsCard}>
                <Text style={styles.cardTitle}>Help</Text>
                <Text style={styles.inlineMuted}>PulseChat Mobile WhatsApp-style layout ke saath backend, realtime chat, status aur settings support karta hai.</Text>
                <Text style={styles.inlineMuted}>Server: pulsechat-api.onrender.com</Text>
                <Text style={styles.inlineMuted}>Need support: APK update install karo aur phir auth/chat retest karo.</Text>
              </View>
            ) : null}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal animationType="slide" onRequestClose={() => setIsChatInfoVisible(false)} visible={isChatInfoVisible}>
        <SafeAreaView style={styles.screen}>
          <View style={styles.modalHeader}>
            <Pressable onPress={() => setIsChatInfoVisible(false)} style={styles.headerIconButton}>
              <Ionicons color={theme.text} name="arrow-back" size={22} />
            </Pressable>
            <Text style={styles.modalHeaderTitle}>Chat info</Text>
            <Pressable onPress={() => handleChatInfoAction("report")} style={styles.headerIconButton}>
              <MaterialCommunityIcons color={theme.text} name="dots-vertical" size={22} />
            </Pressable>
          </View>

          {activeConversation ? (
            <ScrollView contentContainerStyle={styles.modalScroll}>
              <View style={styles.chatInfoHero}>
                <AvatarBadge size={88} user={getConversationAvatar(activeConversation, user._id)} />
                <Text style={styles.chatInfoTitle}>{getConversationTitle(activeConversation, user._id)}</Text>
                <Text style={styles.chatInfoSubtitle}>
                  {uiPrefs.showLastSeen
                    ? getConversationSubtitle(activeConversation, user._id)
                    : activeConversation?.kind === "group"
                      ? `${activeConversation.participants?.length || 0} members`
                      : "Last seen hidden"}
                </Text>
              </View>

              <View style={styles.chatInfoActionRow}>
                {[
                  ["call-outline", "Audio", () => startCall("audio", activeConversation._id), "ion"],
                  ["videocam-outline", "Video", () => startCall("video", activeConversation._id), "ion"],
                  ["search", "Search", () => handleChatInfoAction("search"), "feather"],
                  ["harddisk", "Storage", () => handleChatInfoAction("storage"), "mci"]
                ].map(([icon, label, handler, family]) => (
                  <Pressable key={label} onPress={handler} style={styles.chatInfoActionButton}>
                    <View style={styles.chatInfoActionIcon}>
                      {family === "ion" ? <Ionicons color={theme.text} name={icon} size={22} /> : null}
                      {family === "feather" ? <Feather color={theme.text} name={icon} size={20} /> : null}
                      {family === "mci" ? <MaterialCommunityIcons color={theme.text} name={icon} size={22} /> : null}
                    </View>
                    <Text style={styles.chatInfoActionCopy}>{label}</Text>
                  </Pressable>
                ))}
              </View>

              <View style={styles.settingsCard}>
                <View style={styles.settingsRowStandalone}>
                  <View style={styles.settingsRowCopy}>
                    <Text style={styles.settingsRowTitle}>Media, links and docs</Text>
                    <Text style={styles.settingsRowSubtitle}>{chatMediaItems.length} item(s) in this chat</Text>
                  </View>
                  <Text style={styles.metricValue}>{formatBytes(chatStorageBytes)}</Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.mediaPreviewRow}>
                    {chatMediaItems.length ? (
                      chatMediaItems.slice(0, 5).map((item, index) => (
                        <View key={`${item.messageId}-${index}`} style={styles.mediaPreviewCard}>
                          {item.kind === "image" ? (
                            <Image source={{ uri: resolveAssetUrl(item.url) }} style={styles.mediaPreviewImage} />
                          ) : (
                            <>
                              <MaterialCommunityIcons color={theme.accent} name="file-document-outline" size={24} />
                              <Text numberOfLines={2} style={styles.mediaPreviewCopy}>
                                {item.originalName || item.kind}
                              </Text>
                            </>
                          )}
                        </View>
                      ))
                    ) : (
                      <Text style={styles.inlineMuted}>No media shared in this chat yet.</Text>
                    )}
                  </View>
                </ScrollView>
              </View>

              <View style={styles.settingsCard}>
                {[
                  ["notifications", "Notifications", "Mute/unmute chat alerts"],
                  ["mediaVisibility", "Media visibility", "Control local media visibility"],
                  ["disappearing", "Disappearing messages", "Auto-clean chat preference"],
                  ["locked", "Chat lock", "Hide this chat from quick list"],
                  ["advancedPrivacy", "Advanced chat privacy", "Extra local privacy toggle"],
                  ["favorite", "Add to favourites", "Pin this chat in your favourites"],
                  ["savedToList", "Add to list", "Save chat into your custom list"]
                ].map(([key, title, subtitle]) => (
                  <View key={key} style={styles.toggleRow}>
                    <View style={styles.settingsRowCopy}>
                      <Text style={styles.settingsRowTitle}>{title}</Text>
                      <Text style={styles.settingsRowSubtitle}>{subtitle}</Text>
                    </View>
                    <Switch
                      onValueChange={() => toggleConversationPreference(activeConversation._id, key)}
                      thumbColor={activeConversationPrefs[key] ? theme.accent : theme.muted}
                      trackColor={{ false: theme.panelSoft, true: theme.accentSoft }}
                      value={Boolean(activeConversationPrefs[key])}
                    />
                  </View>
                ))}

                <View style={styles.settingsRowStandalone}>
                  <View style={styles.settingsRowCopy}>
                    <Text style={styles.settingsRowTitle}>Encryption</Text>
                    <Text style={styles.settingsRowSubtitle}>Messages and calls are end-to-end encrypted.</Text>
                  </View>
                  <MaterialCommunityIcons color={theme.accent} name="lock-check-outline" size={22} />
                </View>
              </View>

              <View style={styles.settingsCard}>
                <Pressable onPress={() => handleChatInfoAction("groups")} style={styles.settingsRow}>
                  <MaterialCommunityIcons color={theme.accent} name="account-group-outline" size={22} />
                  <View style={styles.settingsRowCopy}>
                    <Text style={styles.settingsRowTitle}>Create group with {activeConversationUser?.name || "this contact"}</Text>
                    <Text style={styles.settingsRowSubtitle}>Community/group flow ka shortcut</Text>
                  </View>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setIsChatInfoVisible(false);
                    handleDeleteChat();
                  }}
                  style={styles.settingsRow}
                >
                  <MaterialCommunityIcons color={theme.muted} name="delete-outline" size={22} />
                  <View style={styles.settingsRowCopy}>
                    <Text style={styles.settingsRowTitle}>Clear chat</Text>
                    <Text style={styles.settingsRowSubtitle}>Current conversation ko remove karega</Text>
                  </View>
                </Pressable>
                {activeConversationUser ? (
                  <Pressable onPress={handleBlockToggle} style={styles.settingsRow}>
                    <MaterialCommunityIcons color={theme.danger} name="block-helper" size={22} />
                    <View style={styles.settingsRowCopy}>
                      <Text style={[styles.settingsRowTitle, { color: theme.danger }]}>
                        {activeConversationUser.isBlocked ? `Unblock ${activeConversationUser.name}` : `Block ${activeConversationUser.name}`}
                      </Text>
                      <Text style={styles.settingsRowSubtitle}>Direct contact control</Text>
                    </View>
                  </Pressable>
                ) : null}
                <Pressable onPress={() => handleChatInfoAction("report")} style={styles.settingsRow}>
                  <MaterialCommunityIcons color={theme.danger} name="alert-circle-outline" size={22} />
                  <View style={styles.settingsRowCopy}>
                    <Text style={[styles.settingsRowTitle, { color: theme.danger }]}>Report chat</Text>
                    <Text style={styles.settingsRowSubtitle}>Flag this chat for review</Text>
                  </View>
                </Pressable>
              </View>
            </ScrollView>
          ) : null}
        </SafeAreaView>
      </Modal>

      <MessageActionSheet
        canDeleteForEveryone={canDeleteForEveryone}
        message={selectedMessage}
        onClose={() => setSelectedMessage(null)}
        onCopy={handleCopyMessage}
        onDeleteForEveryone={handleDeleteForEveryone}
        onDeleteForSelf={handleDeleteForSelf}
        onShare={handleShareMessage}
        theme={theme}
        visible={Boolean(selectedMessage)}
      />

      <CallModal
        callState={callState}
        localStream={localStream}
        onAnswer={handleAnswerCall}
        onDecline={() => endCallSession({ emitDecline: true, emitEnd: false, reason: "declined" })}
        onEnd={() => endCallSession({ emitEnd: true })}
        onToggleMic={handleToggleMic}
        onToggleSpeaker={handleToggleSpeaker}
        onToggleVideo={handleToggleVideo}
        remoteStream={remoteStream}
        theme={theme}
        visible={callState.open}
      />
    </SafeAreaView>
  );
}

const getRequestMessage = (requestError, fallbackMessage) => {
  if (requestError?.response?.data?.message) {
    return requestError.response.data.message;
  }

  if (requestError?.code === "ECONNABORTED") {
    return "Server response me bahut time lag raha hai. Thodi der baad dobara try karo.";
  }

  if (requestError?.code === "ERR_NETWORK") {
    return "Network issue mila. EXPO_PUBLIC_API_URL aur EXPO_PUBLIC_SOCKET_URL check karo.";
  }

  return fallbackMessage;
};

const createStyles = (theme) =>
  StyleSheet.create({
    attachmentCard: {
      backgroundColor: theme.panelSoft,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      gap: 4,
      marginBottom: 8,
      padding: 12
    },
    attachmentHeader: {
      alignItems: "center",
      flexDirection: "row",
      gap: 8
    },
    attachmentMeta: {
      color: theme.muted,
      fontSize: 12
    },
    attachmentTitle: {
      color: theme.text,
      fontSize: 14,
      fontWeight: "700"
    },
    blockedRow: {
      alignItems: "center",
      borderTopColor: theme.divider,
      borderTopWidth: 1,
      flexDirection: "row",
      gap: 12,
      paddingTop: 12
    },
    cardTitle: {
      color: theme.text,
      fontSize: 18,
      fontWeight: "800"
    },
    centeredCard: {
      alignItems: "center",
      backgroundColor: theme.card,
      borderColor: theme.border,
      borderRadius: 28,
      borderWidth: 1,
      gap: 12,
      margin: 20,
      padding: 24
    },
    centeredCopy: {
      color: theme.muted,
      fontSize: 15,
      lineHeight: 22,
      textAlign: "center"
    },
    centeredInline: {
      alignItems: "center",
      gap: 10,
      paddingVertical: 28
    },
    centeredTitle: {
      color: theme.text,
      fontSize: 24,
      fontWeight: "800"
    },
    chatHeader: {
      alignItems: "center",
      backgroundColor: theme.card,
      borderBottomColor: theme.divider,
      borderBottomWidth: 1,
      flexDirection: "row",
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 12
    },
    chatInfoActionButton: {
      alignItems: "center",
      flex: 1,
      gap: 8
    },
    chatInfoActionCopy: {
      color: theme.text,
      fontSize: 13,
      fontWeight: "700"
    },
    chatInfoActionIcon: {
      alignItems: "center",
      backgroundColor: theme.panelSoft,
      borderRadius: 999,
      height: 56,
      justifyContent: "center",
      width: 56
    },
    chatInfoActionRow: {
      flexDirection: "row",
      gap: 10,
      justifyContent: "space-between"
    },
    chatInfoHero: {
      alignItems: "center",
      gap: 10,
      paddingBottom: 8
    },
    chatInfoSubtitle: {
      color: theme.muted,
      fontSize: 15,
      textAlign: "center"
    },
    chatInfoTitle: {
      color: theme.text,
      fontSize: 30,
      fontWeight: "800",
      textAlign: "center"
    },
    chatSearchClose: {
      alignItems: "center",
      justifyContent: "center",
      minHeight: 32,
      minWidth: 32
    },
    chatSearchInput: {
      color: theme.text,
      flex: 1,
      fontSize: 15,
      paddingVertical: 8
    },
    chatSearchShell: {
      alignItems: "center",
      backgroundColor: theme.input,
      borderColor: theme.border,
      borderRadius: 18,
      borderWidth: 1,
      flexDirection: "row",
      gap: 10,
      marginHorizontal: 14,
      marginTop: 12,
      paddingHorizontal: 14
    },
    chatScroll: {
      flex: 1
    },
    chatScrollContent: {
      gap: 10,
      padding: 14,
      paddingBottom: 22
    },
    composer: {
      alignItems: "flex-end",
      backgroundColor: theme.card,
      borderTopColor: theme.divider,
      borderTopWidth: 1,
      flexDirection: "row",
      gap: 10,
      padding: 12
    },
    pendingAttachment: {
      alignItems: "center",
      backgroundColor: theme.card,
      borderTopColor: theme.divider,
      borderTopWidth: 1,
      flexDirection: "row",
      gap: 12,
      paddingHorizontal: 12,
      paddingTop: 12
    },
    pendingAttachmentCopy: {
      flex: 1,
      gap: 2
    },
    pendingAttachmentIconShell: {
      alignItems: "center",
      backgroundColor: theme.panelSoft,
      borderRadius: 14,
      height: 56,
      justifyContent: "center",
      width: 56
    },
    pendingAttachmentMeta: {
      color: theme.muted,
      fontSize: 12
    },
    pendingAttachmentPreview: {
      borderRadius: 14,
      height: 56,
      width: 56
    },
    pendingAttachmentRemove: {
      alignItems: "center",
      justifyContent: "center",
      minHeight: 36,
      minWidth: 36
    },
    pendingAttachmentTitle: {
      color: theme.text,
      fontSize: 14,
      fontWeight: "700"
    },
    composerAccessory: {
      alignItems: "center",
      backgroundColor: theme.input,
      borderColor: theme.border,
      borderRadius: 999,
      borderWidth: 1,
      height: 42,
      justifyContent: "center",
      width: 42
    },
    composerInput: {
      backgroundColor: theme.input,
      borderColor: theme.border,
      borderRadius: 24,
      borderWidth: 1,
      color: theme.text,
      flex: 1,
      maxHeight: 120,
      minHeight: 50,
      paddingHorizontal: 16,
      paddingTop: 14
    },
    callActionButton: {
      alignItems: "center",
      backgroundColor: theme.panelSoft,
      borderRadius: 999,
      height: 36,
      justifyContent: "center",
      width: 36
    },
    callActions: {
      flexDirection: "row",
      gap: 10
    },
    dayChipCopy: {
      color: theme.muted,
      fontSize: 12,
      fontWeight: "700"
    },
    dayChipShell: {
      alignItems: "center",
      paddingVertical: 6
    },
    deletedCopy: {
      color: theme.muted,
      fontStyle: "italic"
    },
    emptyCard: {
      backgroundColor: theme.card,
      borderColor: theme.border,
      borderRadius: 24,
      borderWidth: 1,
      gap: 8,
      padding: 18
    },
    emptyCopy: {
      color: theme.muted,
      fontSize: 14,
      lineHeight: 22
    },
    emptyTitle: {
      color: theme.text,
      fontSize: 18,
      fontWeight: "800"
    },
    errorChip: {
      backgroundColor: "rgba(255, 107, 107, 0.12)",
      borderRadius: 14,
      marginHorizontal: 16,
      marginTop: 10,
      paddingHorizontal: 14,
      paddingVertical: 12
    },
    errorCopy: {
      color: theme.danger,
      fontSize: 14,
      lineHeight: 20
    },
    flex: {
      flex: 1
    },
    filterChip: {
      backgroundColor: theme.card,
      borderColor: theme.border,
      borderRadius: 999,
      borderWidth: 1,
      paddingHorizontal: 18,
      paddingVertical: 10
    },
    filterChipActive: {
      backgroundColor: theme.accentSoft,
      borderColor: theme.accent
    },
    filterChipCopy: {
      color: theme.muted,
      fontSize: 14,
      fontWeight: "700"
    },
    filterChipCopyActive: {
      color: theme.accent
    },
    filterRoundButton: {
      alignItems: "center",
      borderColor: theme.border,
      borderRadius: 999,
      borderWidth: 1,
      height: 42,
      justifyContent: "center",
      width: 42
    },
    filterRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: 10
    },
    filterSpacer: {
      flex: 1
    },
    headerActionCopy: {
      color: theme.text,
      fontSize: 13,
      fontWeight: "700"
    },
    headerBack: {
      paddingRight: 2
    },
    headerButtons: {
      alignItems: "center",
      flexDirection: "row",
      gap: 8
    },
    headerIconButton: {
      alignItems: "center",
      borderRadius: 999,
      height: 38,
      justifyContent: "center",
      width: 38
    },
    headerChipButton: {
      backgroundColor: theme.panelSoft,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 10
    },
    headerIdentity: {
      alignItems: "center",
      flex: 1,
      flexDirection: "row",
      gap: 12
    },
    headerIdentityCopy: {
      flex: 1
    },
    headerSubtitle: {
      color: theme.muted,
      fontSize: 13,
      marginTop: 2
    },
    headerTitle: {
      color: theme.text,
      fontSize: 17,
      fontWeight: "800"
    },
    inlineAction: {
      backgroundColor: theme.accentSoft,
      borderRadius: 999,
      paddingHorizontal: 14,
      paddingVertical: 10
    },
    inlineActionCopy: {
      color: theme.accent,
      fontSize: 13,
      fontWeight: "800"
    },
    inlineMuted: {
      color: theme.muted,
      fontSize: 14,
      lineHeight: 20
    },
    input: {
      backgroundColor: theme.input,
      borderColor: theme.border,
      borderRadius: 18,
      borderWidth: 1,
      color: theme.text,
      fontSize: 15,
      paddingHorizontal: 16,
      paddingVertical: 14
    },
    inputGroup: {
      gap: 8
    },
    inputLabel: {
      color: theme.muted,
      fontSize: 13,
      fontWeight: "700"
    },
    lockedRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: 12,
      paddingBottom: 8,
      paddingTop: 2
    },
    lockedRowCopy: {
      color: theme.muted,
      flex: 1,
      fontSize: 16,
      fontWeight: "700"
    },
    lockedRowCount: {
      color: theme.muted,
      fontSize: 14,
      fontWeight: "700"
    },
    listCard: {
      alignItems: "center",
      backgroundColor: theme.card,
      borderColor: theme.border,
      borderRadius: 22,
      borderWidth: 1,
      flexDirection: "row",
      gap: 12,
      padding: 14
    },
    listCardCompact: {
      alignItems: "center",
      backgroundColor: theme.background,
      flexDirection: "row",
      gap: 14,
      paddingVertical: 10
    },
    listCopy: {
      flex: 1,
      gap: 2
    },
    listStatus: {
      color: theme.accent,
      fontSize: 12,
      fontWeight: "700",
      marginTop: 2
    },
    listSubtitle: {
      color: theme.muted,
      fontSize: 13
    },
    listTime: {
      color: theme.muted,
      fontSize: 12
    },
    listTitle: {
      color: theme.text,
      fontSize: 16,
      fontWeight: "700"
    },
    listTopline: {
      alignItems: "center",
      flexDirection: "row",
      gap: 10,
      justifyContent: "space-between"
    },
    messageBubble: {
      borderRadius: 22,
      maxWidth: "84%",
      minWidth: 120,
      paddingHorizontal: 14,
      paddingVertical: 12
    },
    messageBubbleIncoming: {
      borderBottomLeftRadius: 8
    },
    messageBubbleOwn: {
      borderBottomRightRadius: 8
    },
    messageCopy: {
      color: theme.text,
      fontSize: 15,
      lineHeight: 22,
      marginBottom: 6
    },
    messageImage: {
      borderRadius: 16,
      height: 220,
      marginBottom: 8,
      width: 220
    },
    messageRow: {
      flexDirection: "row"
    },
    messageRowOwn: {
      justifyContent: "flex-end"
    },
    messageTime: {
      color: theme.muted,
      fontSize: 11,
      textAlign: "right"
    },
    mediaPreviewCard: {
      alignItems: "center",
      backgroundColor: theme.panelSoft,
      borderRadius: 18,
      gap: 8,
      height: 104,
      justifyContent: "center",
      overflow: "hidden",
      padding: 10,
      width: 104
    },
    mediaPreviewCopy: {
      color: theme.text,
      fontSize: 11,
      lineHeight: 16,
      textAlign: "center"
    },
    mediaPreviewImage: {
      height: "100%",
      width: "100%"
    },
    mediaPreviewRow: {
      flexDirection: "row",
      gap: 10
    },
    metricRow: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between"
    },
    metricValue: {
      color: theme.accent,
      fontSize: 14,
      fontWeight: "800"
    },
    modalBackdrop: {
      ...StyleSheet.absoluteFillObject
    },
    modalHeader: {
      alignItems: "center",
      backgroundColor: theme.card,
      borderBottomColor: theme.divider,
      borderBottomWidth: 1,
      flexDirection: "row",
      justifyContent: "space-between",
      paddingHorizontal: 12,
      paddingVertical: 12
    },
    modalHeaderTitle: {
      color: theme.text,
      flex: 1,
      fontSize: 20,
      fontWeight: "800",
      textAlign: "center"
    },
    modalScroll: {
      gap: 16,
      padding: 16,
      paddingBottom: 30
    },
    noticeChip: {
      alignSelf: "center",
      backgroundColor: theme.card,
      borderColor: theme.border,
      borderRadius: 999,
      borderWidth: 1,
      marginTop: 10,
      paddingHorizontal: 16,
      paddingVertical: 10
    },
    noticeCopy: {
      color: theme.text,
      fontSize: 13,
      fontWeight: "700"
    },
    primaryButton: {
      alignItems: "center",
      backgroundColor: theme.accent,
      borderRadius: 18,
      paddingHorizontal: 16,
      paddingVertical: 14
    },
    primaryButtonCopy: {
      color: theme.mode === "dark" ? "#081317" : "#ffffff",
      fontSize: 15,
      fontWeight: "800"
    },
    screen: {
      backgroundColor: theme.background,
      flex: 1
    },
    searchField: {
      alignItems: "center",
      backgroundColor: theme.input,
      borderRadius: 18,
      flexDirection: "row",
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 6
    },
    searchInput: {
      color: theme.text,
      flex: 1,
      fontSize: 15,
      paddingVertical: 12
    },
    searchShell: {
      paddingHorizontal: 16,
      paddingTop: 14
    },
    secondaryButton: {
      alignItems: "center",
      backgroundColor: theme.panelSoft,
      borderRadius: 18,
      paddingHorizontal: 16,
      paddingVertical: 14
    },
    secondaryButtonCopy: {
      color: theme.text,
      fontSize: 15,
      fontWeight: "700"
    },
    sectionCaption: {
      color: theme.muted,
      fontSize: 13,
      fontWeight: "700",
      marginTop: 6
    },
    sectionTitle: {
      color: theme.text,
      fontSize: 24,
      fontWeight: "800"
    },
    sendButton: {
      alignItems: "center",
      backgroundColor: theme.accent,
      borderRadius: 999,
      justifyContent: "center",
      minHeight: 50,
      minWidth: 74,
      paddingHorizontal: 16
    },
    sendButtonCopy: {
      color: theme.mode === "dark" ? "#081317" : "#ffffff",
      fontSize: 14,
      fontWeight: "800"
    },
    settingsCard: {
      backgroundColor: theme.card,
      borderColor: theme.border,
      borderRadius: 24,
      borderWidth: 1,
      gap: 14,
      padding: 16
    },
    settingsRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: 14,
      paddingVertical: 2
    },
    settingsRowCopy: {
      flex: 1,
      gap: 2
    },
    settingsRowStandalone: {
      alignItems: "center",
      flexDirection: "row",
      gap: 14,
      justifyContent: "space-between"
    },
    settingsRowSubtitle: {
      color: theme.muted,
      fontSize: 13,
      lineHeight: 18
    },
    settingsRowTitle: {
      color: theme.text,
      fontSize: 15,
      fontWeight: "700"
    },
    startCopy: {
      color: theme.accent,
      fontSize: 13,
      fontWeight: "800"
    },
    tabButton: {
      alignItems: "center",
      borderRadius: 20,
      flex: 1,
      gap: 4,
      paddingVertical: 10
    },
    tabButtonActive: {
      backgroundColor: theme.accentSoft
    },
    tabButtonCopy: {
      color: theme.muted,
      fontSize: 13,
      fontWeight: "700"
    },
    tabButtonCopyActive: {
      color: theme.accent
    },
    tabContent: {
      gap: 12,
      padding: 16,
      paddingBottom: 110
    },
    tabbar: {
      backgroundColor: theme.card,
      borderTopColor: theme.divider,
      borderTopWidth: 1,
      bottom: 0,
      flexDirection: "row",
      gap: 8,
      left: 0,
      paddingHorizontal: 12,
      paddingTop: 10,
      paddingBottom: Platform.OS === "ios" ? 22 : 14,
      position: "absolute",
      right: 0
    },
    topbar: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingTop: 12
    },
    topbarActions: {
      flexDirection: "row",
      gap: 8
    },
    topbarIconButton: {
      alignItems: "center",
      borderRadius: 999,
      height: 38,
      justifyContent: "center",
      width: 38
    },
    topbarChip: {
      backgroundColor: theme.panelSoft,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 10
    },
    topbarChipCopy: {
      color: theme.text,
      fontSize: 13,
      fontWeight: "700"
    },
    topbarSubtitle: {
      color: theme.muted,
      fontSize: 13,
      marginTop: 4
    },
    topbarTitle: {
      color: theme.text,
      fontSize: 28,
      fontWeight: "800"
    },
    popupMenu: {
      borderRadius: 18,
      borderWidth: 1,
      position: "absolute",
      right: 18,
      top: Platform.OS === "ios" ? 72 : 56,
      width: 180
    },
    popupMenuCopy: {
      color: theme.text,
      fontSize: 15,
      fontWeight: "700"
    },
    popupMenuItem: {
      paddingHorizontal: 16,
      paddingVertical: 14
    },
    toggleRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: 14,
      justifyContent: "space-between"
    },
    unreadBadge: {
      alignItems: "center",
      backgroundColor: theme.accent,
      borderRadius: 999,
      justifyContent: "center",
      minHeight: 26,
      minWidth: 26,
      paddingHorizontal: 8
    },
    unreadCopy: {
      color: theme.mode === "dark" ? "#081317" : "#ffffff",
      fontSize: 12,
      fontWeight: "800"
    }
  });
