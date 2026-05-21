import { useEffect, useRef, useState } from "react";

import { io } from "socket.io-client";

import apiClient from "../api/client.js";
import {
  AccountIcon,
  AudioCallIcon,
  CallsIcon,
  CameraIcon,
  ChatsIcon,
  HelpIcon,
  LanguageIcon,
  LogoutIcon,
  MoreIcon,
  PrivacyIcon,
  SettingsIcon,
  StatusIcon,
  StorageIcon,
  VideoCallIcon
} from "../components/AppIcons.jsx";
import AvatarBadge from "../components/AvatarBadge.jsx";
import CallModal from "../components/CallModal.jsx";
import ChatInfoPanel from "../components/ChatInfoPanel.jsx";
import ChatMediaPanel from "../components/ChatMediaPanel.jsx";
import ChatSidebar from "../components/ChatSidebar.jsx";
import ChatWindow from "../components/ChatWindow.jsx";
import GroupComposerModal from "../components/GroupComposerModal.jsx";
import SettingsModal from "../components/SettingsModal.jsx";
import StoryComposerModal from "../components/StoryComposerModal.jsx";
import StoryStrip from "../components/StoryStrip.jsx";
import StoryViewerModal from "../components/StoryViewerModal.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import {
  applyPresenceToConversations,
  applyPresenceToUsers,
  formatSidebarTime,
  getConversationAvatar,
  getConversationTitle,
  getOtherParticipant,
  isConversationRestricted,
  patchConversationPresence,
  patchUserPresence,
  removeConversation,
  sortConversations,
  upsertConversation,
  upsertMessage
} from "../utils/chat.js";

const socketUrl = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";
const parseIceServers = () => {
  const configuredIceServers = import.meta.env.VITE_ICE_SERVERS;

  if (configuredIceServers) {
    try {
      const parsed = JSON.parse(configuredIceServers);

      if (Array.isArray(parsed) && parsed.length) {
        return parsed;
      }
    } catch {
      // Fall back to STUN/TURN env parsing below.
    }
  }

  const parseUrlList = (value = "") =>
    value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

  const stunUrls = parseUrlList(import.meta.env.VITE_STUN_URLS || "stun:stun.l.google.com:19302");
  const turnUrls = parseUrlList(import.meta.env.VITE_TURN_URLS || "");
  const turnUsername = import.meta.env.VITE_TURN_USERNAME || "";
  const turnCredential = import.meta.env.VITE_TURN_CREDENTIAL || "";

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
  conversationId: null,
  connectedAt: null,
  direction: null,
  isMicMuted: false,
  isRemoteAudioMuted: false,
  isVideoEnabled: true,
  open: false,
  partner: null,
  phase: "idle",
  startedAt: null,
  status: "",
  type: "audio"
};
const conversationPreferenceStorageKey = "pulsechat:conversation-preferences";
const hiddenMessageStoragePrefix = "pulsechat:hidden-messages";
const defaultConversationPreferences = {
  advancedPrivacy: false,
  chatLock: false,
  disappearingMessages: "Off",
  favourite: false,
  listName: "No list",
  mediaVisibility: true,
  notificationsMuted: false,
  reported: false
};

function ChatPage({ onToggleTheme, theme }) {
  const { logout, setCurrentUser, token, user } = useAuth();
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [activeStoryGroup, setActiveStoryGroup] = useState(null);
  const [activeTab, setActiveTab] = useState("chats");
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [callState, setCallState] = useState(defaultCallState);
  const [chatNotice, setChatNotice] = useState(null);
  const [chatSearchQuery, setChatSearchQuery] = useState("");
  const [conversationPreferences, setConversationPreferences] = useState(() => {
    try {
      return JSON.parse(window.localStorage.getItem(conversationPreferenceStorageKey) || "{}");
    } catch {
      return {};
    }
  });
  const [groupInitialSelectedIds, setGroupInitialSelectedIds] = useState([]);
  const [isChatInfoOpen, setIsChatInfoOpen] = useState(false);
  const [isChatMediaOpen, setIsChatMediaOpen] = useState(false);
  const [isChatSearchOpen, setIsChatSearchOpen] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [error, setError] = useState("");
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isStoryComposerOpen, setIsStoryComposerOpen] = useState(false);
  const [isStoryViewerOpen, setIsStoryViewerOpen] = useState(false);
  const [localStream, setLocalStream] = useState(null);
  const [messages, setMessages] = useState([]);
  const [hiddenMessageMap, setHiddenMessageMap] = useState({});
  const [remoteStream, setRemoteStream] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [stories, setStories] = useState([]);
  const [unreadMap, setUnreadMap] = useState({});
  const [unlockedChatIds, setUnlockedChatIds] = useState({});

  const activeConversationRef = useRef(activeConversationId);
  const callStateRef = useRef(callState);
  const incomingOfferRef = useRef(null);
  const localStreamRef = useRef(null);
  const pendingIceCandidatesRef = useRef([]);
  const peerConnectionRef = useRef(null);
  const socketRef = useRef(null);

  useEffect(() => {
    activeConversationRef.current = activeConversationId;
  }, [activeConversationId]);

  useEffect(() => {
    callStateRef.current = callState;
  }, [callState]);

  useEffect(() => {
    window.localStorage.setItem(conversationPreferenceStorageKey, JSON.stringify(conversationPreferences));
  }, [conversationPreferences]);

  useEffect(() => {
    if (!user?._id) {
      setHiddenMessageMap({});
      return;
    }

    try {
      setHiddenMessageMap(JSON.parse(window.localStorage.getItem(`${hiddenMessageStoragePrefix}:${user._id}`) || "{}"));
    } catch {
      setHiddenMessageMap({});
    }
  }, [user?._id]);

  useEffect(() => {
    if (!user?._id) {
      return;
    }

    window.localStorage.setItem(`${hiddenMessageStoragePrefix}:${user._id}`, JSON.stringify(hiddenMessageMap));
  }, [hiddenMessageMap, user?._id]);

  useEffect(() => {
    if (!chatNotice) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => setChatNotice(null), 2400);
    return () => window.clearTimeout(timeoutId);
  }, [chatNotice]);

  const getErrorMessage = (requestError, fallbackMessage) =>
    requestError?.response?.data?.message || requestError?.message || fallbackMessage;
  const getConversationPreferences = (conversationId) => ({
    ...defaultConversationPreferences,
    ...(conversationId ? conversationPreferences[conversationId] || {} : {})
  });
  const showNotice = (message, tone = "info") => {
    setChatNotice({
      id: Date.now(),
      message,
      tone
    });
  };
  const updateConversationPreferences = (conversationId, updates) => {
    if (!conversationId) {
      return;
    }

    setConversationPreferences((current) => ({
      ...current,
      [conversationId]: {
        ...defaultConversationPreferences,
        ...(current[conversationId] || {}),
        ...updates
      }
    }));
  };
  const hideMessageForSelf = (conversationId, messageId) => {
    if (!conversationId || !messageId) {
      return;
    }

    setHiddenMessageMap((current) => ({
      ...current,
      [conversationId]: Array.from(new Set([...(current[conversationId] || []), messageId]))
    }));
  };

  const fetchStories = async () => {
    const response = await apiClient.get("/stories");
    setStories(response.data);
    return response.data;
  };

  const hydrateDashboard = async () => {
    const [usersResponse, conversationsResponse, blockedUsersResponse] = await Promise.all([
      apiClient.get("/users"),
      apiClient.get("/chats"),
      apiClient.get("/users/blocked")
    ]);

    await fetchStories();

    const nextConversations = sortConversations(conversationsResponse.data);
    setBlockedUsers(blockedUsersResponse.data);
    setContacts(usersResponse.data);
    setConversations(nextConversations);
    setActiveConversationId((currentId) =>
      currentId && nextConversations.some((conversation) => conversation._id === currentId) ? currentId : null
    );
  };

  const resetCallMedia = () => {
    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;

    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;

    incomingOfferRef.current = null;
    pendingIceCandidatesRef.current = [];
    setLocalStream(null);
    setRemoteStream(null);
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
    }

    if (reason === "connection-lost") {
      setError("Call connection was lost.");
    }

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
        // Ignore invalid queued ICE candidates.
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

  const getUserMediaStream = async (type) => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: type === "video"
    });

    localStreamRef.current = stream;
    setLocalStream(stream);
    return stream;
  };

  useEffect(() => {
    if (!user?._id) {
      return;
    }

    let ignore = false;

    const loadInitialData = async () => {
      setError("");
      setIsPageLoading(true);

      try {
        await hydrateDashboard();
      } catch (requestError) {
        if (!ignore) {
          setError(getErrorMessage(requestError, "Unable to load your chat dashboard."));
        }
      } finally {
        if (!ignore) {
          setIsPageLoading(false);
        }
      }
    };

    loadInitialData();

    return () => {
      ignore = true;
    };
  }, [user?._id]);

  useEffect(() => {
    if (!activeConversationId) {
      setMessages([]);
      return;
    }

    let ignore = false;

    const loadMessages = async () => {
      setError("");
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
          setError(getErrorMessage(requestError, "Unable to load messages."));
        }
      } finally {
        if (!ignore) {
          setIsLoadingMessages(false);
        }
      }
    };

    loadMessages();

    return () => {
      ignore = true;
    };
  }, [activeConversationId]);

  useEffect(() => {
    if (!token || !user?._id) {
      return undefined;
    }

    const socket = io(socketUrl, {
      auth: { token },
      transports: ["websocket"]
    });

    socketRef.current = socket;

    socket.on("presence:list", ({ userIds }) => {
      setContacts((current) => applyPresenceToUsers(current, userIds));
      setConversations((current) => applyPresenceToConversations(current, userIds));
    });

    socket.on("presence:update", ({ userId, isOnline, lastSeenAt }) => {
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

    socket.on("message:read", ({ messageIds, readerId }) => {
      setMessages((current) =>
        current.map((message) =>
          messageIds.includes(message._id) && !message.readBy.includes(readerId)
            ? { ...message, readBy: [...message.readBy, readerId] }
            : message
        )
      );
    });

    socket.on("chat:deleted", ({ conversationId }) => {
      setConversations((current) => {
        const next = removeConversation(current, conversationId);

        if (activeConversationRef.current === conversationId) {
          setActiveConversationId(null);
          setMessages([]);
        }

        return next;
      });
    });

    socket.on("story:new", () => {
      void fetchStories();
    });

    socket.on("call:offer", ({ callType, conversationId, fromUser, sdp }) => {
      if (callStateRef.current.open) {
        socket.emit("call:decline", { reason: "busy", toUserId: fromUser._id });
        return;
      }

      incomingOfferRef.current = sdp;
      setActiveConversationId(conversationId);
      setActiveTab("chats");
      setIsChatInfoOpen(false);
      setIsChatMediaOpen(false);
      setIsChatSearchOpen(false);
      setCallState({
        conversationId,
        connectedAt: null,
        direction: "incoming",
        isMicMuted: false,
        isRemoteAudioMuted: false,
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
      setError(reason === "busy" ? "The other person is busy." : "The other person declined the call.");
    });

    socket.on("call:end", () => {
      endCallSession({
        emitEnd: false,
        reason: callStateRef.current.phase === "incoming" ? "missed" : "remote-ended"
      });
    });

    socket.on("connect_error", () => {
      setError("Realtime connection failed. Refresh after backend starts, then chat will sync live.");
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token, user?._id]);

  const handleTabChange = (nextTab) => {
    setActiveTab(nextTab);
    setIsChatInfoOpen(false);
    setIsChatMediaOpen(false);
    setIsChatSearchOpen(false);
    setIsMoreMenuOpen(false);
    setChatSearchQuery("");

    if (nextTab !== "chats") {
      setActiveConversationId(null);
    }
  };

  const handleSelectConversation = (conversationId) => {
    setActiveTab("chats");
    setIsChatInfoOpen(false);
    setIsChatMediaOpen(false);
    setIsChatSearchOpen(false);
    setChatSearchQuery("");
    setActiveConversationId(conversationId);
  };

  const handleStartConversation = async (targetUserId) => {
    const existingConversation = conversations.find(
      (conversation) => conversation.kind === "direct" && getOtherParticipant(conversation, user._id)?._id === targetUserId
    );

    if (existingConversation) {
      handleSelectConversation(existingConversation._id);
      return existingConversation;
    }

    const targetContact = contacts.find((contact) => contact._id === targetUserId);

    if (targetContact?.isBlocked) {
      setError("Unblock this contact first from settings or chat actions.");
      return null;
    }

    if (targetContact?.hasBlockedYou) {
      setError("This contact blocked you, so a new conversation cannot be started.");
      return null;
    }

    try {
      const response = await apiClient.post(`/chats/direct/${targetUserId}`);
      setConversations((current) => upsertConversation(current, response.data));
      setIsChatInfoOpen(false);
      setIsChatMediaOpen(false);
      setIsChatSearchOpen(false);
      setChatSearchQuery("");
      setActiveConversationId(response.data._id);
      setActiveTab("chats");
      return response.data;
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Unable to start this conversation."));
      return null;
    }
  };

  const handleCreateGroup = async (payload) => {
    try {
      const response = await apiClient.post("/chats/group", payload);
      setConversations((current) => upsertConversation(current, response.data));
      setIsChatInfoOpen(false);
      setIsChatMediaOpen(false);
      setActiveConversationId(response.data._id);
      setActiveTab("chats");
      setGroupInitialSelectedIds([]);
      setIsGroupModalOpen(false);
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Unable to create group."));
      throw requestError;
    }
  };

  const handleCreateStory = async ({ caption, file, text }) => {
    try {
      const payload = new FormData();

      if (caption.trim()) {
        payload.append("caption", caption.trim());
      }

      if (text.trim()) {
        payload.append("text", text.trim());
      }

      if (file) {
        payload.append("storyMedia", file);
      }

      await apiClient.post("/stories", payload);
      await fetchStories();
      setIsStoryComposerOpen(false);
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Unable to post status."));
      throw requestError;
    }
  };

  const handleViewedStory = async (storyId) => {
    try {
      await apiClient.post(`/stories/${storyId}/view`);
    } catch {
      // Non-blocking.
    }
  };

  const handleOpenStory = (storyGroup) => {
    setActiveStoryGroup(storyGroup);
    setIsStoryViewerOpen(true);

    if (storyGroup?.stories?.[0]?._id) {
      void handleViewedStory(storyGroup.stories[0]._id);
    }
  };

  const handleSendMessage = async ({ file, text }) => {
    if (!activeConversationId || (!text.trim() && !file)) {
      return false;
    }

    setError("");
    setIsSendingMessage(true);

    try {
      const payload = new FormData();
      payload.append("text", text);

      if (file) {
        payload.append("attachment", file);
      }

      const response = await apiClient.post(`/chats/${activeConversationId}/messages`, payload);
      setConversations((current) => upsertConversation(current, response.data.conversation));
      setMessages((current) => upsertMessage(current, response.data.message));
      return true;
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Unable to send message."));
      return false;
    } finally {
      setIsSendingMessage(false);
    }
  };

  const handleDeleteMessage = async (messageId) => {
    if (!activeConversationId) {
      return;
    }

    try {
      const response = await apiClient.delete(`/chats/${activeConversationId}/messages/${messageId}`);
      setMessages((current) => upsertMessage(current, response.data.message));
      setConversations((current) =>
        current.map((conversation) =>
          conversation._id === activeConversationId && conversation.lastMessage === response.data.message._id
            ? { ...conversation, lastMessagePreview: "Message deleted" }
            : conversation
        )
      );
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Unable to delete message."));
    }
  };

  const handleDeleteMessageForSelf = (messageId) => {
    hideMessageForSelf(activeConversationId, messageId);
    showNotice("Message deleted for you.");
  };

  const getShareTextForMessage = (message) => {
    const attachmentSummary = (message.attachments || [])
      .map((attachment) => `${attachment.kind}: ${attachment.originalName}`)
      .join("\n");
    return [message.text?.trim(), attachmentSummary].filter(Boolean).join("\n");
  };

  const handleCopyMessage = async (message) => {
    const content = getShareTextForMessage(message);

    if (!content) {
      showNotice("Nothing to copy for this message.");
      return;
    }

    try {
      await navigator.clipboard.writeText(content);
      showNotice("Message copied.");
    } catch {
      setError("Unable to copy this message.");
    }
  };

  const handleShareMessage = async (message) => {
    const content = getShareTextForMessage(message);

    if (!content) {
      showNotice("Nothing to share for this message.");
      return;
    }

    try {
      if (navigator.share) {
        await navigator.share({
          text: content,
          title: "PulseChat message"
        });
        showNotice("Message shared.");
        return;
      }

      await navigator.clipboard.writeText(content);
      showNotice("Share text copied.");
    } catch {
      setError("Unable to share this message.");
    }
  };

  const handleDeleteConversation = async () => {
    if (!activeConversationId) {
      return;
    }

    if (!window.confirm("Delete this chat? In this version, it removes the conversation for every participant.")) {
      return;
    }

    try {
      const response = await apiClient.delete(`/chats/${activeConversationId}`);
      setConversations((current) => removeConversation(current, response.data.conversationId));
      setActiveConversationId(null);
      setIsChatInfoOpen(false);
      setIsChatMediaOpen(false);
      setIsChatSearchOpen(false);
      setChatSearchQuery("");
      setMessages([]);
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Unable to delete chat."));
    }
  };

  const handleBlockToggle = async () => {
    const currentConversation =
      conversations.find((conversation) => conversation._id === activeConversationId) || null;
    const otherUser = currentConversation ? getOtherParticipant(currentConversation, user._id) : null;

    if (!otherUser) {
      return;
    }

    try {
      const response = otherUser.isBlocked
        ? await apiClient.delete(`/users/${otherUser._id}/block`)
        : await apiClient.post(`/users/${otherUser._id}/block`);

      if (response.data.user) {
        setCurrentUser(response.data.user);
      }

      await hydrateDashboard();
      setBlockedUsers(response.data.blockedUsers || []);
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Unable to update block status."));
    }
  };

  const handleSaveProfile = async (payload) => {
    const response = await apiClient.patch("/users/me", payload);
    setCurrentUser(response.data.user);
  };

  const handleUploadAvatar = async (file) => {
    const payload = new FormData();
    payload.append("avatar", file);
    const response = await apiClient.post("/users/me/avatar", payload);
    setCurrentUser(response.data.user);
  };

  const handleChangePassword = async (payload) => {
    await apiClient.post("/auth/change-password", payload);
  };

  const handleUnblock = async (userId) => {
    const response = await apiClient.delete(`/users/${userId}/block`);

    if (response.data.user) {
      setCurrentUser(response.data.user);
    }

    setBlockedUsers(response.data.blockedUsers || []);
    await hydrateDashboard();
  };

  const startCall = async (type, conversationId = activeConversationId) => {
    const currentConversation = conversations.find((conversation) => conversation._id === conversationId);

    if (!currentConversation || currentConversation.kind === "group") {
      setError("Audio and video calling is available for direct chats in this version.");
      return;
    }

    const partner = getOtherParticipant(currentConversation, user._id);

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
        conversationId,
        connectedAt: null,
        direction: "outgoing",
        isMicMuted: false,
        isRemoteAudioMuted: false,
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
      setError(getErrorMessage(requestError, "Unable to start the call."));
    }
  };

  const handleQuickCall = async (targetUserId, type) => {
    const conversation = await handleStartConversation(targetUserId);

    if (conversation?._id) {
      await startCall(type, conversation._id);
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
      setError(getErrorMessage(requestError, "Unable to answer the call."));
    }
  };

  const handleToggleMic = () => {
    const audioTrack = localStreamRef.current?.getAudioTracks?.()[0];

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
    const videoTrack = localStreamRef.current?.getVideoTracks?.()[0];

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

  const handleToggleRemoteAudio = () => {
    setCallState((current) => ({
      ...current,
      isRemoteAudioMuted: !current.isRemoteAudioMuted
    }));
  };

  const handleConversationBack = () => {
    setActiveConversationId(null);
    setIsChatInfoOpen(false);
    setIsChatMediaOpen(false);
    setIsChatSearchOpen(false);
    setChatSearchQuery("");
  };

  const handleOpenChatSearch = () => {
    setIsChatInfoOpen(false);
    setIsChatSearchOpen(true);
    setChatSearchQuery("");
  };

  const handleCloseChatSearch = () => {
    setIsChatSearchOpen(false);
    setChatSearchQuery("");
  };

  const handleOpenChatMedia = () => {
    setIsChatMediaOpen(true);
  };

  const handleToggleNotifications = () => {
    const preferences = getConversationPreferences(activeConversationId);
    const nextValue = !preferences.notificationsMuted;
    updateConversationPreferences(activeConversationId, { notificationsMuted: nextValue });
    showNotice(nextValue ? "Notifications muted for this chat." : "Notifications enabled for this chat.");
  };

  const handleToggleMediaVisibility = () => {
    const preferences = getConversationPreferences(activeConversationId);
    const nextValue = !preferences.mediaVisibility;
    updateConversationPreferences(activeConversationId, { mediaVisibility: nextValue });
    showNotice(nextValue ? "Shared media is visible in this chat." : "Shared media preview is hidden for this chat.");
  };

  const handleShowEncryptionInfo = () => {
    showNotice("Messages and calls in this chat are end-to-end encrypted.");
  };

  const handleCycleDisappearingMessages = () => {
    const options = ["Off", "24 hours", "7 days", "90 days"];
    const preferences = getConversationPreferences(activeConversationId);
    const currentIndex = options.indexOf(preferences.disappearingMessages);
    const nextValue = options[(currentIndex + 1) % options.length];
    updateConversationPreferences(activeConversationId, { disappearingMessages: nextValue });
    showNotice(`Disappearing messages set to ${nextValue}.`);
  };

  const handleToggleChatLock = () => {
    const preferences = getConversationPreferences(activeConversationId);
    const nextValue = !preferences.chatLock;
    updateConversationPreferences(activeConversationId, { chatLock: nextValue });
    setUnlockedChatIds((current) => ({
      ...current,
      [activeConversationId]: !nextValue
    }));
    showNotice(nextValue ? "Chat lock enabled." : "Chat lock removed.");
  };

  const handleUnlockChat = () => {
    setUnlockedChatIds((current) => ({
      ...current,
      [activeConversationId]: true
    }));
    showNotice("Chat unlocked on this device.");
  };

  const handleToggleAdvancedPrivacy = () => {
    const preferences = getConversationPreferences(activeConversationId);
    const nextValue = !preferences.advancedPrivacy;
    updateConversationPreferences(activeConversationId, { advancedPrivacy: nextValue });
    showNotice(nextValue ? "Advanced chat privacy enabled." : "Advanced chat privacy disabled.");
  };

  const handleToggleFavourite = () => {
    const preferences = getConversationPreferences(activeConversationId);
    const nextValue = !preferences.favourite;
    updateConversationPreferences(activeConversationId, { favourite: nextValue });
    showNotice(nextValue ? "Chat added to favourites." : "Chat removed from favourites.");
  };

  const handleCycleList = () => {
    const options = ["No list", "Family", "Work", "Study"];
    const preferences = getConversationPreferences(activeConversationId);
    const currentIndex = options.indexOf(preferences.listName);
    const nextValue = options[(currentIndex + 1) % options.length];
    updateConversationPreferences(activeConversationId, { listName: nextValue });
    showNotice(nextValue === "No list" ? "Chat removed from lists." : `Chat added to ${nextValue}.`);
  };

  const handleOpenGroupFromInfo = () => {
    const otherUser = activeConversation ? getOtherParticipant(activeConversation, user._id) : null;
    setGroupInitialSelectedIds(otherUser?._id ? [otherUser._id] : []);
    setIsGroupModalOpen(true);
  };

  const handleReportConversation = () => {
    if (!window.confirm("Report this contact?")) {
      return;
    }

    updateConversationPreferences(activeConversationId, { reported: true });
    showNotice("Contact reported.");
  };

  const activeConversation =
    conversations.find((conversation) => conversation._id === activeConversationId) || null;
  const activeConversationPreferences = getConversationPreferences(activeConversationId);
  const hiddenMessageIds = activeConversationId ? hiddenMessageMap[activeConversationId] || [] : [];
  const isActiveConversationLocked =
    Boolean(activeConversationId) &&
    activeConversationPreferences.chatLock &&
    !unlockedChatIds[activeConversationId];
  const composerDisabled =
    isSendingMessage || isLoadingMessages || (activeConversation && isConversationRestricted(activeConversation, user._id));

  const directConversations = conversations.filter((conversation) => conversation.kind === "direct");
  const callTargets = directConversations.length
    ? directConversations.map((conversation) => ({
        conversation,
        target: getOtherParticipant(conversation, user._id)
      }))
    : contacts
        .filter((contact) => !contact.isBlocked && !contact.hasBlockedYou)
        .map((contact) => ({
          conversation: null,
          target: contact
        }));

  if (isPageLoading) {
    return (
      <main className="chat-page loading-shell">
        <div className="loading-card">
          <span className="eyebrow">Syncing from MongoDB Atlas</span>
          <h1>Preparing your chat space</h1>
          <p>Users, groups, stories, and presence are loading...</p>
        </div>
      </main>
    );
  }

  return (
      <main className="chat-page chat-mobile-shell">
      {chatNotice ? <div className={`floating-feedback floating-feedback-${chatNotice.tone}`}>{chatNotice.message}</div> : null}
      {activeConversation && activeTab === "chats" && isChatInfoOpen ? (
        <ChatInfoPanel
          conversation={activeConversation}
          currentUserId={user._id}
          messages={messages}
          onAudioCall={() => startCall("audio")}
          onBack={() => setIsChatInfoOpen(false)}
          onBlockToggle={handleBlockToggle}
          onCycleDisappearingMessages={handleCycleDisappearingMessages}
          onCycleList={handleCycleList}
          onDeleteChat={handleDeleteConversation}
          onManageStorage={handleOpenChatMedia}
          onOpenMedia={handleOpenChatMedia}
          onOpenGroup={handleOpenGroupFromInfo}
          onOpenSearch={handleOpenChatSearch}
          onReport={handleReportConversation}
          onShowEncryptionInfo={handleShowEncryptionInfo}
          onToggleAdvancedPrivacy={handleToggleAdvancedPrivacy}
          onToggleChatLock={handleToggleChatLock}
          onToggleFavourite={handleToggleFavourite}
          onToggleMediaVisibility={handleToggleMediaVisibility}
          onToggleNotifications={handleToggleNotifications}
          onVideoCall={() => startCall("video")}
          preferences={activeConversationPreferences}
        />
      ) : activeConversation && activeTab === "chats" ? (
        <ChatWindow
          activeConversation={activeConversation}
          conversationPreferences={activeConversationPreferences}
          currentUserId={user._id}
          hiddenMessageIds={hiddenMessageIds}
          isLocked={isActiveConversationLocked}
          isLoadingMessages={isLoadingMessages}
          isSearchOpen={isChatSearchOpen}
          messages={messages}
          onAudioCall={() => startCall("audio")}
          onCopyMessage={handleCopyMessage}
          onBack={handleConversationBack}
          onBlockToggle={handleBlockToggle}
          onDeleteChat={handleDeleteConversation}
          onDeleteMessage={handleDeleteMessage}
          onDeleteMessageForSelf={handleDeleteMessageForSelf}
          onOpenInfo={() => setIsChatInfoOpen(true)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onSearchClose={handleCloseChatSearch}
          onSearchQueryChange={setChatSearchQuery}
          onSendMessage={handleSendMessage}
          onShareMessage={handleShareMessage}
          onUnlock={handleUnlockChat}
          onVideoCall={() => startCall("video")}
          searchQuery={chatSearchQuery}
          sendDisabled={composerDisabled}
        />
      ) : (
        <>
          <header className="mobile-topbar">
            <h1>PulseChat</h1>

            <div className="mobile-topbar-actions">
              <button
                aria-label="Open camera"
                className="icon-button"
                onClick={() => setIsStoryComposerOpen(true)}
                type="button"
              >
                <CameraIcon />
              </button>
              <button
                aria-label="More options"
                className="icon-button"
                onClick={() => setIsMoreMenuOpen((current) => !current)}
                type="button"
              >
                <MoreIcon />
              </button>

              {isMoreMenuOpen ? (
                <div className="topbar-menu">
                  <button onClick={() => setIsGroupModalOpen(true)} type="button">
                    New group
                  </button>
                  <button onClick={() => handleTabChange("settings")} type="button">
                    Settings
                  </button>
                  <button onClick={logout} type="button">
                    Logout
                  </button>
                </div>
              ) : null}
            </div>
          </header>

          {error ? <div className="floating-error floating-error-dark">{error}</div> : null}

          <section className="mobile-content">
            {activeTab === "chats" ? (
              <ChatSidebar
                activeConversationId={activeConversationId}
                contacts={contacts}
                conversationPreferences={conversationPreferences}
                conversations={conversations}
                currentUser={user}
                onCreateGroup={() => setIsGroupModalOpen(true)}
                onSelectConversation={handleSelectConversation}
                onStartConversation={handleStartConversation}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                unreadMap={unreadMap}
              />
            ) : null}

            {activeTab === "status" ? (
              <section className="mobile-panel">
                <div className="mobile-inline-heading">
                  <h2>Status</h2>
                  <span>{stories.length}</span>
                </div>

                <StoryStrip
                  currentUser={user}
                  onCreateGroup={() => setIsGroupModalOpen(true)}
                  onCreateStory={() => setIsStoryComposerOpen(true)}
                  onOpenStory={handleOpenStory}
                  storyGroups={stories}
                />

                <div className="status-feed">
                  {stories.length ? (
                    stories.map((storyGroup) => (
                      <button
                        className="status-feed-card"
                        key={storyGroup.author._id}
                        onClick={() => handleOpenStory(storyGroup)}
                        type="button"
                      >
                        <AvatarBadge size="md" user={storyGroup.author} />
                        <div className="status-feed-copy">
                          <strong>{storyGroup.author.name}</strong>
                          <span>{storyGroup.stories[0]?.caption || storyGroup.stories[0]?.text || "Tap to view status"}</span>
                        </div>
                        <em>{formatSidebarTime(storyGroup.stories[0]?.createdAt)}</em>
                      </button>
                    ))
                  ) : (
                    <div className="whats-empty-state">
                      <strong>No status updates yet</strong>
                      <span>Use the camera button to post your first story.</span>
                    </div>
                  )}
                </div>
              </section>
            ) : null}

            {activeTab === "calls" ? (
              <section className="mobile-panel">
                <div className="mobile-inline-heading">
                  <h2>Call history</h2>
                  <span>{callTargets.length}</span>
                </div>

                <div className="call-feed">
                  {callTargets.length ? (
                    callTargets.map(({ conversation, target }) => {
                      const avatar = conversation ? getConversationAvatar(conversation, user._id) : target;

                      return (
                        <div className="call-feed-card" key={conversation?._id || target._id}>
                          <div className="user-chip">
                            <AvatarBadge size="sm" user={avatar} />
                            <div className="call-feed-copy">
                              <strong>{conversation ? getConversationTitle(conversation, user._id) : target.name}</strong>
                              <span>{target.about || target.email}</span>
                            </div>
                          </div>

                          <div className="call-feed-actions">
                            <button
                              aria-label="Audio call"
                              className="icon-button"
                              onClick={() => handleQuickCall(target._id, "audio")}
                              type="button"
                            >
                              <AudioCallIcon size={18} />
                            </button>
                            <button
                              aria-label="Video call"
                              className="icon-button"
                              onClick={() => handleQuickCall(target._id, "video")}
                              type="button"
                            >
                              <VideoCallIcon size={18} />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="whats-empty-state">
                      <strong>No call history yet</strong>
                      <span>Start an audio or video call from here.</span>
                    </div>
                  )}
                </div>
              </section>
            ) : null}

            {activeTab === "settings" ? (
              <section className="mobile-panel settings-tab-panel">
                <button className="settings-profile-card" onClick={() => setIsSettingsOpen(true)} type="button">
                  <AvatarBadge size="md" user={user} />
                  <div className="settings-profile-copy">
                    <strong>{user?.name}</strong>
                    <span>{user?.about || user?.email}</span>
                  </div>
                </button>

                <div className="settings-list">
                  <button className="settings-list-item" onClick={() => setIsSettingsOpen(true)} type="button">
                    <AccountIcon size={20} />
                    <div>
                      <strong>Account</strong>
                      <span>Profile photo, name, password</span>
                    </div>
                  </button>
                  <button className="settings-list-item" onClick={() => setIsSettingsOpen(true)} type="button">
                    <PrivacyIcon size={20} />
                    <div>
                      <strong>Privacy</strong>
                      <span>Blocked users and account control</span>
                    </div>
                  </button>
                  <button className="settings-list-item" onClick={onToggleTheme} type="button">
                    <SettingsIcon size={20} />
                    <div>
                      <strong>Theme</strong>
                      <span>{theme === "dark" ? "Dark mode active" : "Light mode active"}</span>
                    </div>
                  </button>
                  <div className="settings-list-item">
                    <LanguageIcon size={20} />
                    <div>
                      <strong>App language</strong>
                      <span>English</span>
                    </div>
                  </div>
                  <div className="settings-list-item">
                    <HelpIcon size={20} />
                    <div>
                      <strong>Help</strong>
                      <span>Support, FAQ, contact us</span>
                    </div>
                  </div>
                  <div className="settings-list-item">
                    <StorageIcon size={20} />
                    <div>
                      <strong>Storage and data</strong>
                      <span>Manage media quality and usage</span>
                    </div>
                  </div>
                  <button className="settings-list-item danger-text" onClick={logout} type="button">
                    <LogoutIcon size={20} />
                    <div>
                      <strong>Logout</strong>
                      <span>Sign out of PulseChat</span>
                    </div>
                  </button>
                </div>
              </section>
            ) : null}
          </section>

          <nav className="bottom-tabbar">
            <button
              className={`tabbar-button ${activeTab === "chats" ? "tabbar-button-active" : ""}`}
              onClick={() => handleTabChange("chats")}
              type="button"
            >
              <ChatsIcon size={20} />
              <span>Chats</span>
            </button>
            <button
              className={`tabbar-button ${activeTab === "status" ? "tabbar-button-active" : ""}`}
              onClick={() => handleTabChange("status")}
              type="button"
            >
              <StatusIcon size={20} />
              <span>Status</span>
            </button>
            <button
              className={`tabbar-button ${activeTab === "calls" ? "tabbar-button-active" : ""}`}
              onClick={() => handleTabChange("calls")}
              type="button"
            >
              <CallsIcon size={20} />
              <span>Calls</span>
            </button>
          </nav>
        </>
      )}

      <SettingsModal
        blockedUsers={blockedUsers}
        isOpen={isSettingsOpen}
        onChangePassword={handleChangePassword}
        onClose={() => setIsSettingsOpen(false)}
        onSaveProfile={handleSaveProfile}
        onUnblock={handleUnblock}
        onUploadAvatar={handleUploadAvatar}
        user={user}
      />

      <GroupComposerModal
        contacts={contacts}
        initialSelectedIds={groupInitialSelectedIds}
        isOpen={isGroupModalOpen}
        onClose={() => {
          setGroupInitialSelectedIds([]);
          setIsGroupModalOpen(false);
        }}
        onCreateGroup={handleCreateGroup}
      />

      <ChatMediaPanel
        conversation={activeConversation}
        currentUserId={user?._id}
        isOpen={isChatMediaOpen}
        messages={messages}
        onClose={() => setIsChatMediaOpen(false)}
      />

      <StoryComposerModal
        isOpen={isStoryComposerOpen}
        onClose={() => setIsStoryComposerOpen(false)}
        onCreateStory={handleCreateStory}
      />

      <StoryViewerModal
        isOpen={isStoryViewerOpen}
        onClose={() => setIsStoryViewerOpen(false)}
        onViewed={handleViewedStory}
        storyGroup={activeStoryGroup}
      />

      <CallModal
        callState={callState}
        localStream={localStream}
        onAnswer={handleAnswerCall}
        onDecline={() => endCallSession({ emitDecline: true, emitEnd: false })}
        onEnd={() => endCallSession({ emitEnd: true })}
        onToggleMic={handleToggleMic}
        onToggleRemoteAudio={handleToggleRemoteAudio}
        onToggleVideo={handleToggleVideo}
        remoteStream={remoteStream}
      />
    </main>
  );
}

export default ChatPage;
