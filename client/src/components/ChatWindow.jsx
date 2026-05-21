import { useEffect, useRef, useState } from "react";

import { AudioCallIcon, BackIcon, CopyIcon, LockIcon, MoreIcon, SearchIcon, ShareIcon, VideoCallIcon } from "./AppIcons.jsx";
import AttachmentView from "./AttachmentView.jsx";
import AvatarBadge from "./AvatarBadge.jsx";
import EmptyState from "./EmptyState.jsx";
import MessageComposer from "./MessageComposer.jsx";
import {
  formatMessageDay,
  formatMessageTime,
  getConversationAvatar,
  getConversationSubtitle,
  getConversationTitle,
  getOtherParticipant,
  getReadReceiptLabel
} from "../utils/chat.js";

function ChatWindow({
  activeConversation,
  conversationPreferences,
  currentUserId,
  hiddenMessageIds = [],
  isLocked,
  isLoadingMessages,
  isSearchOpen,
  messages,
  onAudioCall,
  onBack,
  onBlockToggle,
  onCopyMessage,
  onDeleteChat,
  onDeleteMessage,
  onDeleteMessageForSelf,
  onOpenInfo,
  onOpenSettings,
  onSearchClose,
  onSearchQueryChange,
  onSendMessage,
  onShareMessage,
  onUnlock,
  onVideoCall,
  searchQuery,
  sendDisabled
}) {
  const messagesEndRef = useRef(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const query = searchQuery.trim().toLowerCase();
  const availableMessages = messages.filter((message) => !hiddenMessageIds.includes(message._id));
  const visibleMessages = query
    ? availableMessages.filter((message) => {
        const haystack = [
          message.text,
          ...(message.attachments || []).map((attachment) => `${attachment.originalName} ${attachment.kind}`)
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(query);
      })
    : availableMessages;
  const headerSubtitle = conversationPreferences.advancedPrivacy
    ? "Privacy protected"
    : getConversationSubtitle(activeConversation, currentUserId);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [hiddenMessageIds, messages, query]);

  useEffect(() => {
    setIsMenuOpen(false);
    setSelectedMessage(null);
  }, [activeConversation?._id]);

  if (!activeConversation) {
    return <EmptyState onOpenSidebar={onBack} />;
  }

  const otherUser = getOtherParticipant(activeConversation, currentUserId);
  const avatar = getConversationAvatar(activeConversation, currentUserId);
  const restrictionMessage = otherUser?.isBlocked
    ? "You blocked this contact. Unblock to send new messages."
    : otherUser?.hasBlockedYou
      ? "This contact blocked you. Messaging is unavailable."
      : "";
  const handleOpenMessageActions = (event, message) => {
    if (event.target.closest("a, button, video, audio, input, textarea")) {
      return;
    }

    setSelectedMessage(message);
  };
  const closeMessageActions = () => setSelectedMessage(null);
  const handleCopySelectedMessage = () => {
    if (!selectedMessage) {
      return;
    }

    onCopyMessage?.(selectedMessage);
    closeMessageActions();
  };
  const handleShareSelectedMessage = () => {
    if (!selectedMessage) {
      return;
    }

    onShareMessage?.(selectedMessage);
    closeMessageActions();
  };
  const handleDeleteSelectedForSelf = () => {
    if (!selectedMessage) {
      return;
    }

    onDeleteMessageForSelf?.(selectedMessage._id);
    closeMessageActions();
  };
  const handleDeleteSelectedForEveryone = () => {
    if (!selectedMessage) {
      return;
    }

    onDeleteMessage?.(selectedMessage._id);
    closeMessageActions();
  };
  const canDeleteForEveryone =
    Boolean(selectedMessage) &&
    selectedMessage.sender?._id === currentUserId &&
    !selectedMessage.isDeleted;
  const canShareOrCopy = Boolean(selectedMessage) && !selectedMessage.isDeleted;

  return (
    <section className="chat-window">
      <header className="chat-header">
        <div className="header-left">
          <button aria-label="Back to chats" className="icon-button" onClick={onBack} type="button">
            <BackIcon />
          </button>
          <button className="chat-title-trigger" onClick={onOpenInfo} type="button">
            <div className="conversation-avatar-wrap">
              <AvatarBadge size="sm" user={avatar} />
              {otherUser?.isOnline ? <span className="status-dot" /> : null}
            </div>
            <div className="chat-title-copy">
              <strong>{getConversationTitle(activeConversation, currentUserId)}</strong>
              <span>{headerSubtitle}</span>
            </div>
          </button>
        </div>
        <div className="header-actions header-actions-compact">
          <button aria-label="Audio call" className="icon-button" onClick={onAudioCall} type="button">
            <AudioCallIcon />
          </button>
          <button aria-label="Video call" className="icon-button" onClick={onVideoCall} type="button">
            <VideoCallIcon />
          </button>
          <button
            aria-label="Conversation menu"
            className="icon-button"
            onClick={() => setIsMenuOpen((current) => !current)}
            type="button"
          >
            <MoreIcon />
          </button>
          {isMenuOpen ? (
            <div className="conversation-menu">
              <button className="conversation-menu-item" onClick={onOpenSettings} type="button">
                Settings
              </button>
              {activeConversation.kind !== "group" ? (
                <button className="conversation-menu-item" onClick={onBlockToggle} type="button">
                  {otherUser?.isBlocked ? "Unblock" : "Block"}
                </button>
              ) : null}
              <button className="conversation-menu-item danger-text" onClick={onDeleteChat} type="button">
                Delete chat
              </button>
            </div>
          ) : null}
        </div>
      </header>

      {isSearchOpen ? (
        <div className="chat-search-inline">
          <SearchIcon className="mobile-search-icon" size={18} />
          <input
            className="chat-search-input"
            onChange={(event) => onSearchQueryChange(event.target.value)}
            placeholder="Search in chat"
            type="search"
            value={searchQuery}
          />
          <button className="text-button" onClick={onSearchClose} type="button">
            Done
          </button>
        </div>
      ) : null}

      <div className="message-stream">
        {restrictionMessage ? <div className="chat-notice">{restrictionMessage}</div> : null}
        {conversationPreferences.disappearingMessages !== "Off" && !isLocked ? (
          <div className="chat-notice chat-notice-muted">
            Disappearing messages: {conversationPreferences.disappearingMessages}
          </div>
        ) : null}
        {isLocked ? (
          <div className="locked-chat-state">
            <div className="locked-chat-card">
              <LockIcon size={26} />
              <strong>This chat is locked</strong>
              <span>Unlock on this device to read messages and shared media.</span>
              <button className="primary-button" onClick={onUnlock} type="button">
                Unlock chat
              </button>
            </div>
          </div>
        ) : isLoadingMessages ? (
          <div className="stream-hint">Loading messages...</div>
        ) : visibleMessages.length ? (
          visibleMessages.map((message, index) => {
            const isOwnMessage = message.sender?._id === currentUserId;
            const previousMessage = visibleMessages[index - 1];
            const dayLabel = formatMessageDay(message.createdAt);
            const previousDayLabel = previousMessage ? formatMessageDay(previousMessage.createdAt) : "";

            return (
              <div key={message._id}>
                {index === 0 || dayLabel !== previousDayLabel ? (
                  <div className="message-day-chip">
                    <span>{dayLabel}</span>
                  </div>
                ) : null}

                <article className={`message-row ${isOwnMessage ? "message-row-own" : ""}`}>
                  <div
                    aria-label="Open message actions"
                    className={`message-bubble ${isOwnMessage ? "message-own" : "message-incoming"} message-bubble-clickable`}
                    onClick={(event) => handleOpenMessageActions(event, message)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        handleOpenMessageActions(event, message);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    {message.isDeleted ? <p className="deleted-copy">This message was deleted.</p> : null}
                    {!message.isDeleted && message.text ? <p>{message.text}</p> : null}
                    {!message.isDeleted && message.attachments?.length ? (
                      <div className="attachment-stack">
                        {message.attachments.map((attachment) => (
                          <AttachmentView attachment={attachment} key={`${message._id}-${attachment.url}`} />
                        ))}
                      </div>
                    ) : null}
                    <span className="message-time">{formatMessageTime(message.createdAt)}</span>
                    {isOwnMessage && !conversationPreferences.advancedPrivacy ? (
                      <span className="message-receipt">{getReadReceiptLabel(message, currentUserId)}</span>
                    ) : null}
                  </div>
                </article>
              </div>
            );
          })
        ) : query ? (
          <div className="stream-hint">
            <strong>No results found</strong>
            <span>Try a different word or file name in this chat.</span>
          </div>
        ) : (
          <div className="stream-hint">
            <strong>Say hello.</strong>
            <span>This conversation is ready for realtime messages.</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <MessageComposer
        disabled={isLocked || sendDisabled || Boolean(restrictionMessage)}
        helperText={restrictionMessage}
        key={activeConversation._id}
        onSend={onSendMessage}
      />

      {selectedMessage ? (
        <div aria-modal="true" className="message-action-sheet" role="dialog">
          <button
            aria-label="Close message actions"
            className="message-action-backdrop"
            onClick={closeMessageActions}
            type="button"
          />
          <div className="message-action-panel">
            <div className="message-action-heading">
              <strong>Message options</strong>
              <span>Choose what you want to do with this message</span>
            </div>

            {canShareOrCopy ? (
              <>
                <button className="message-action-option" onClick={handleCopySelectedMessage} type="button">
                  <CopyIcon size={18} />
                  <span>Copy</span>
                </button>
                <button className="message-action-option" onClick={handleShareSelectedMessage} type="button">
                  <ShareIcon size={18} />
                  <span>Share</span>
                </button>
              </>
            ) : null}

            <button className="message-action-option" onClick={handleDeleteSelectedForSelf} type="button">
              <span>Delete for myself</span>
            </button>

            {canDeleteForEveryone ? (
              <button className="message-action-option danger-text" onClick={handleDeleteSelectedForEveryone} type="button">
                <span>Delete for everyone</span>
              </button>
            ) : null}

            <button className="message-action-option" onClick={closeMessageActions} type="button">
              <span>Cancel</span>
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default ChatWindow;
