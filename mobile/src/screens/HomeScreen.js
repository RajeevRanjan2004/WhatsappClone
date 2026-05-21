import React, { useEffect, useMemo, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { io } from "socket.io-client";

import apiClient, { resolveAssetUrl, realtimeUrl } from "../api/client";
import AvatarBadge from "../components/AvatarBadge";
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

export default function HomeScreen() {
  const { logout, setCurrentUser, token, user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [activeTab, setActiveTab] = useState("chats");
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [changePasswordForm, setChangePasswordForm] = useState({
    currentPassword: "",
    newPassword: ""
  });
  const [composerText, setComposerText] = useState("");
  const [contacts, setContacts] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [error, setError] = useState("");
  const [hiddenMessageMap, setHiddenMessageMap] = useState({});
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [messages, setMessages] = useState([]);
  const [notice, setNotice] = useState("");
  const [profileForm, setProfileForm] = useState({
    about: "",
    name: ""
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [stories, setStories] = useState([]);
  const [unreadMap, setUnreadMap] = useState({});

  const activeConversationRef = useRef(activeConversationId);
  const chatScrollRef = useRef(null);
  const socketRef = useRef(null);

  useEffect(() => {
    activeConversationRef.current = activeConversationId;
  }, [activeConversationId]);

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

  useEffect(() => {
    let ignore = false;

    const hydrateDashboard = async () => {
      setError("");
      setIsPageLoading(true);

      try {
        const [usersResponse, conversationsResponse, blockedUsersResponse, storiesResponse] = await Promise.all([
          apiClient.get("/users"),
          apiClient.get("/chats"),
          apiClient.get("/users/blocked"),
          apiClient.get("/stories")
        ]);

        if (ignore) {
          return;
        }

        setContacts(usersResponse.data);
        setConversations(sortConversations(conversationsResponse.data));
        setBlockedUsers(blockedUsersResponse.data);
        setStories(storiesResponse.data);
      } catch (requestError) {
        if (!ignore) {
          setError(getRequestMessage(requestError, "Unable to load the mobile dashboard."));
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
    };
  }, []);

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
        const response = await apiClient.get("/stories");
        setStories(response.data);
      } catch {
        // Ignore story refresh issues in the background.
      }
    });

    socket.on("connect_error", () => {
      setError("Realtime socket connect nahi hua. Backend URL ya public socket URL check karo.");
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token, user?._id]);

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

  const handleSelectConversation = (conversationId) => {
    setActiveTab("chats");
    setActiveConversationId(conversationId);
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
    if (!activeConversationId || !composerText.trim()) {
      return;
    }

    setIsSendingMessage(true);

    try {
      const response = await apiClient.post(`/chats/${activeConversationId}/messages`, {
        text: composerText.trim()
      });

      setComposerText("");
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

  const handleCallPlaceholder = (type) => {
    Alert.alert(
      `${type === "video" ? "Video" : "Audio"} calls`,
      "React Native client ka chat, auth, status aur settings ready hai. Native call stack ko next phase me react-native-webrtc ke saath wire karna hoga."
    );
  };

  const activeConversation = conversations.find((conversation) => conversation._id === activeConversationId) || null;
  const hiddenMessageIds = activeConversationId ? hiddenMessageMap[activeConversationId] || [] : [];
  const visibleMessages = messages.filter((message) => !hiddenMessageIds.includes(message._id));
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
  const canDeleteForEveryone = selectedMessage?.sender?._id === user._id && !selectedMessage?.isDeleted;
  const composerDisabled =
    isSendingMessage || isLoadingMessages || (activeConversation && isConversationRestricted(activeConversation, user._id));

  if (isPageLoading) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.centeredCard}>
          <ActivityIndicator color={theme.accent} size="large" />
          <Text style={styles.centeredTitle}>Preparing PulseChat Mobile</Text>
          <Text style={styles.centeredCopy}>Chats, contacts, status aur settings sync ho rahe hain.</Text>
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
            <Pressable onPress={() => setActiveConversationId(null)} style={styles.headerBack}>
              <Text style={styles.headerActionCopy}>Back</Text>
            </Pressable>

            <Pressable style={styles.headerIdentity}>
              <AvatarBadge size={42} user={getConversationAvatar(activeConversation, user._id)} />
              <View style={styles.headerIdentityCopy}>
                <Text numberOfLines={1} style={styles.headerTitle}>
                  {getConversationTitle(activeConversation, user._id)}
                </Text>
                <Text numberOfLines={1} style={styles.headerSubtitle}>
                  {getConversationSubtitle(activeConversation, user._id)}
                </Text>
              </View>
            </Pressable>

            <View style={styles.headerButtons}>
              <Pressable onPress={() => handleCallPlaceholder("audio")} style={styles.headerChipButton}>
                <Text style={styles.headerActionCopy}>Call</Text>
              </Pressable>
              <Pressable onPress={handleDeleteChat} style={styles.headerChipButton}>
                <Text style={[styles.headerActionCopy, { color: theme.danger }]}>Delete</Text>
              </Pressable>
            </View>
          </View>

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
            ) : visibleMessages.length ? (
              visibleMessages.map((message, index) => {
                const isOwnMessage = message.sender?._id === user._id;
                const dayLabel = formatMessageDay(message.createdAt);
                const previousDayLabel = index > 0 ? formatMessageDay(visibleMessages[index - 1].createdAt) : "";
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
                            <Image source={{ uri: resolveAssetUrl(attachment.url) }} style={styles.messageImage} />
                          ) : (
                            <View style={styles.attachmentCard}>
                              <Text style={styles.attachmentTitle}>{attachment.originalName || attachment.kind}</Text>
                              <Text style={styles.attachmentMeta}>
                                {attachment.kind} · {formatBytes(attachment.size)}
                              </Text>
                            </View>
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

          <View style={styles.composer}>
            <TextInput
              editable={!composerDisabled}
              multiline
              onChangeText={setComposerText}
              placeholder="Message"
              placeholderTextColor={theme.muted}
              style={styles.composerInput}
              value={composerText}
            />
            <Pressable disabled={composerDisabled} onPress={handleSendMessage} style={styles.sendButton}>
              <Text style={styles.sendButtonCopy}>{isSendingMessage ? "..." : "Send"}</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      ) : (
        <>
          <View style={styles.topbar}>
            <View>
              <Text style={styles.topbarTitle}>PulseChat</Text>
              <Text style={styles.topbarSubtitle}>React Native mobile client</Text>
            </View>

            <View style={styles.topbarActions}>
              <Pressable onPress={toggleTheme} style={styles.topbarChip}>
                <Text style={styles.topbarChipCopy}>{theme.mode === "dark" ? "Light" : "Dark"}</Text>
              </Pressable>
              <Pressable onPress={logout} style={styles.topbarChip}>
                <Text style={styles.topbarChipCopy}>Logout</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.searchShell}>
            <TextInput
              onChangeText={setSearchQuery}
              placeholder="Search chats or contacts"
              placeholderTextColor={theme.muted}
              style={styles.searchInput}
              value={searchQuery}
            />
          </View>

          <ScrollView contentContainerStyle={styles.tabContent} showsVerticalScrollIndicator={false}>
            {activeTab === "chats" ? (
              <>
                <Text style={styles.sectionTitle}>Chats</Text>

                {filteredConversations.length ? (
                  filteredConversations.map((conversation) => {
                    const avatar = getConversationAvatar(conversation, user._id);
                    const otherUser = conversation.kind === "direct" ? getOtherParticipant(conversation, user._id) : null;

                    return (
                      <Pressable key={conversation._id} onPress={() => handleSelectConversation(conversation._id)} style={styles.listCard}>
                        <AvatarBadge size={54} user={avatar} />
                        <View style={styles.listCopy}>
                          <View style={styles.listTopline}>
                            <Text numberOfLines={1} style={styles.listTitle}>
                              {getConversationTitle(conversation, user._id)}
                            </Text>
                            <Text style={styles.listTime}>{formatSidebarTime(conversation.lastMessageAt)}</Text>
                          </View>
                          <Text numberOfLines={1} style={styles.listSubtitle}>
                            {conversation.lastMessagePreview || getConversationSubtitle(conversation, user._id)}
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
                    <Text style={styles.emptyCopy}>Search karke kisi contact ke saath new chat start karo.</Text>
                  </View>
                )}

                {suggestedContacts.length ? (
                  <>
                    <Text style={styles.sectionCaption}>Start a new chat</Text>
                    {suggestedContacts.map((contact) => (
                      <Pressable key={contact._id} onPress={() => handleStartConversation(contact._id)} style={styles.listCard}>
                        <AvatarBadge size={48} user={contact} />
                        <View style={styles.listCopy}>
                          <Text style={styles.listTitle}>{contact.name}</Text>
                          <Text style={styles.listSubtitle}>{contact.about || contact.email}</Text>
                        </View>
                        <Text style={styles.startCopy}>Start</Text>
                      </Pressable>
                    ))}
                  </>
                ) : null}
              </>
            ) : null}

            {activeTab === "status" ? (
              <>
                <Text style={styles.sectionTitle}>Status</Text>
                {stories.length ? (
                  stories.map((storyGroup) => (
                    <View key={storyGroup.author._id} style={styles.listCard}>
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
                    <Text style={styles.emptyCopy}>Backend stories route connected hai. Mobile story composer next pass me add ho sakta hai.</Text>
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
                    <View key={conversation._id} style={styles.listCard}>
                      <AvatarBadge size={50} user={getConversationAvatar(conversation, user._id)} />
                      <View style={styles.listCopy}>
                        <Text style={styles.listTitle}>{getConversationTitle(conversation, user._id)}</Text>
                        <Text style={styles.listSubtitle}>{getConversationSubtitle(conversation, user._id)}</Text>
                      </View>
                      <Pressable onPress={() => handleCallPlaceholder("audio")} style={styles.inlineAction}>
                        <Text style={styles.inlineActionCopy}>Call</Text>
                      </Pressable>
                    </View>
                  ))}
              </>
            ) : null}

            {activeTab === "settings" ? (
              <>
                <Text style={styles.sectionTitle}>Settings</Text>

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
                  <Text style={styles.cardTitle}>Theme</Text>
                  <Pressable onPress={toggleTheme} style={styles.secondaryButton}>
                    <Text style={styles.secondaryButtonCopy}>
                      Switch to {theme.mode === "dark" ? "light" : "dark"} mode
                    </Text>
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
          </ScrollView>

          <View style={styles.tabbar}>
            {[
              ["chats", "Chats"],
              ["status", "Status"],
              ["calls", "Calls"],
              ["settings", "Settings"]
            ].map(([key, label]) => (
              <Pressable
                key={key}
                onPress={() => {
                  setActiveTab(key);
                  setActiveConversationId(null);
                }}
                style={[styles.tabButton, activeTab === key ? styles.tabButtonActive : null]}
              >
                <Text style={[styles.tabButtonCopy, activeTab === key ? styles.tabButtonCopyActive : null]}>{label}</Text>
              </Pressable>
            ))}
          </View>
        </>
      )}

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
    </SafeAreaView>
  );
}

const getRequestMessage = (requestError, fallbackMessage) => {
  if (requestError?.response?.data?.message) {
    return requestError.response.data.message;
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
      gap: 4,
      marginBottom: 8,
      padding: 12
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
    searchInput: {
      backgroundColor: theme.input,
      borderColor: theme.border,
      borderRadius: 999,
      borderWidth: 1,
      color: theme.text,
      fontSize: 15,
      paddingHorizontal: 16,
      paddingVertical: 13
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
    startCopy: {
      color: theme.accent,
      fontSize: 13,
      fontWeight: "800"
    },
    tabButton: {
      alignItems: "center",
      borderRadius: 20,
      flex: 1,
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
      alignItems: "flex-start",
      flexDirection: "row",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingTop: 12
    },
    topbarActions: {
      flexDirection: "row",
      gap: 8
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
      fontSize: 32,
      fontWeight: "800"
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
