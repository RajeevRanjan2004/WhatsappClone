import { useState } from "react";

import {
  AudioCallIcon,
  BackIcon,
  ChevronRightIcon,
  FavouriteIcon,
  GroupIcon,
  ListIcon,
  LockIcon,
  MediaIcon,
  MoreIcon,
  NotificationIcon,
  PrivacyIcon,
  ReportIcon,
  SearchIcon,
  ShieldIcon,
  StorageIcon,
  VideoCallIcon
} from "./AppIcons.jsx";
import AvatarBadge from "./AvatarBadge.jsx";
import { resolveAssetUrl } from "../utils/assets.js";
import {
  formatBytes,
  formatMessageDay,
  getConversationAvatar,
  getConversationSubtitle,
  getConversationTitle,
  getOtherParticipant
} from "../utils/chat.js";

function ChatInfoPanel({
  conversation,
  currentUserId,
  messages,
  onAudioCall,
  onBack,
  onBlockToggle,
  onCycleDisappearingMessages,
  onCycleList,
  onDeleteChat,
  onManageStorage,
  onOpenMedia,
  onOpenGroup,
  onOpenSearch,
  onReport,
  onShowEncryptionInfo,
  onToggleAdvancedPrivacy,
  onToggleChatLock,
  onToggleFavourite,
  onToggleMediaVisibility,
  onToggleNotifications,
  onVideoCall,
  preferences
}) {
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const otherUser = getOtherParticipant(conversation, currentUserId);
  const avatar = getConversationAvatar(conversation, currentUserId);
  const recentAttachments = messages
    .filter((message) => !message.isDeleted)
    .flatMap((message) => (message.attachments || []).map((attachment) => ({ ...attachment, createdAt: message.createdAt })))
    .slice(-6)
    .reverse();
  const mediaPreviewItems = recentAttachments.slice(0, 3);
  const totalMediaSize = recentAttachments.reduce((sum, attachment) => sum + (attachment.size || 0), 0);
  const subtitle = getConversationSubtitle(conversation, currentUserId);
  const heroMeta = conversation.kind === "group" ? `${conversation.participants?.length || 0} members` : "";

  const renderMediaTile = (attachment, index) => {
    if (!attachment) {
      return (
        <div className="chat-info-media-tile chat-info-media-empty" key={`empty-${index}`}>
          <MediaIcon size={20} />
        </div>
      );
    }

    if (attachment.kind === "image") {
      return (
        <div className="chat-info-media-tile" key={attachment.url}>
          <img alt={attachment.originalName} src={resolveAssetUrl(attachment.url)} />
        </div>
      );
    }

    return (
      <div className="chat-info-media-tile chat-info-media-file" key={attachment.url}>
        <span>{attachment.kind === "video" ? "Video" : attachment.kind === "audio" ? "Audio" : "Doc"}</span>
      </div>
    );
  };

  return (
    <section className="chat-info-screen">
      <header className="chat-info-topbar">
        <button aria-label="Back to chat" className="icon-button" onClick={onBack} type="button">
          <BackIcon />
        </button>

        <div className="chat-info-topline">
          <AvatarBadge size="sm" user={avatar} />
          <strong>{getConversationTitle(conversation, currentUserId)}</strong>
        </div>

        <button
          aria-label="More details"
          className="icon-button"
          onClick={() => setIsMoreMenuOpen((current) => !current)}
          type="button"
        >
          <MoreIcon size={18} />
        </button>

        {isMoreMenuOpen ? (
          <div className="chat-info-menu">
            <button
              onClick={() => {
                setIsMoreMenuOpen(false);
                onOpenSearch();
              }}
              type="button"
            >
              Search chat
            </button>
            <button
              onClick={() => {
                setIsMoreMenuOpen(false);
                onOpenMedia();
              }}
              type="button"
            >
              Shared media
            </button>
            <button
              className="danger-text"
              onClick={() => {
                setIsMoreMenuOpen(false);
                onDeleteChat();
              }}
              type="button"
            >
              Clear chat
            </button>
          </div>
        ) : null}
      </header>

      <div className="chat-info-scroll">
        <div className="chat-info-hero">
          <AvatarBadge size="lg" user={avatar} />
          <h2>{getConversationTitle(conversation, currentUserId)}</h2>
          {heroMeta ? <p>{heroMeta}</p> : null}
          <span>{subtitle || `Last active ${formatMessageDay(new Date().toISOString())}`}</span>
        </div>

        <div className="chat-info-actions">
          <button className="chat-info-action" onClick={onAudioCall} type="button">
            <div className="chat-info-action-icon">
              <AudioCallIcon size={24} />
            </div>
            <span>Audio</span>
          </button>
          <button className="chat-info-action" onClick={onVideoCall} type="button">
            <div className="chat-info-action-icon">
              <VideoCallIcon size={24} />
            </div>
            <span>Video</span>
          </button>
          <button className="chat-info-action" onClick={onOpenMedia} type="button">
            <div className="chat-info-action-icon chat-info-action-accent">
              <MediaIcon size={22} />
            </div>
            <span>Media</span>
          </button>
          <button className="chat-info-action" onClick={onOpenSearch} type="button">
            <div className="chat-info-action-icon">
              <SearchIcon size={22} />
            </div>
            <span>Search</span>
          </button>
        </div>

        <section className="chat-info-card">
          <div className="chat-info-card-heading">
            <strong>Media, links, and docs</strong>
            <button className="chat-info-arrow" onClick={onOpenMedia} type="button">
              <span>{recentAttachments.length}</span>
              <ChevronRightIcon size={16} />
            </button>
          </div>

          <div className="chat-info-media-row">
            {[0, 1, 2].map((index) => renderMediaTile(mediaPreviewItems[index], index))}
          </div>
        </section>

        <section className="chat-info-list">
          <button className="chat-info-list-row" onClick={onManageStorage} type="button">
            <StorageIcon size={22} />
            <div>
              <strong>Manage storage</strong>
              <span>{formatBytes(totalMediaSize)}</span>
            </div>
          </button>
          <button className="chat-info-list-row" onClick={onToggleNotifications} type="button">
            <NotificationIcon size={22} />
            <div>
              <strong>Notifications</strong>
              <span>{preferences.notificationsMuted ? "Muted" : "On"}</span>
            </div>
          </button>
          <button className="chat-info-list-row" onClick={onToggleMediaVisibility} type="button">
            <MediaIcon size={22} />
            <div>
              <strong>Media visibility</strong>
              <span>{preferences.mediaVisibility ? "On" : "Off"}</span>
            </div>
          </button>
          <button className="chat-info-list-row" onClick={onShowEncryptionInfo} type="button">
            <LockIcon size={22} />
            <div>
              <strong>Encryption</strong>
              <span>Messages and calls are end-to-end encrypted.</span>
            </div>
          </button>
          <button className="chat-info-list-row" onClick={onCycleDisappearingMessages} type="button">
            <PrivacyIcon size={22} />
            <div>
              <strong>Disappearing messages</strong>
              <span>{preferences.disappearingMessages}</span>
            </div>
          </button>
          <button className="chat-info-list-row chat-info-toggle-row" onClick={onToggleChatLock} type="button">
            <ShieldIcon size={22} />
            <div>
              <strong>Chat lock</strong>
              <span>Lock and hide this chat on this device.</span>
            </div>
            <div className={`chat-info-toggle ${preferences.chatLock ? "chat-info-toggle-active" : ""}`}>
              <span />
            </div>
          </button>
          <button className="chat-info-list-row" onClick={onToggleAdvancedPrivacy} type="button">
            <ShieldIcon size={22} />
            <div>
              <strong>Advanced chat privacy</strong>
              <span>{preferences.advancedPrivacy ? "On" : "Off"}</span>
            </div>
          </button>
        </section>

        <section className="chat-info-list">
          <button className="chat-info-list-row" onClick={onOpenGroup} type="button">
            <GroupIcon size={22} />
            <div>
              <strong>Create group with {otherUser?.name || "this contact"}</strong>
            </div>
          </button>
          <button className="chat-info-list-row" onClick={onToggleFavourite} type="button">
            <FavouriteIcon size={22} />
            <div>
              <strong>{preferences.favourite ? "Remove from favourites" : "Add to favourites"}</strong>
              <span>{preferences.favourite ? "Pinned to the top of your chats." : "Keep this chat easy to find."}</span>
            </div>
          </button>
          <button className="chat-info-list-row" onClick={onCycleList} type="button">
            <ListIcon size={22} />
            <div>
              <strong>Add to list</strong>
              <span>{preferences.listName}</span>
            </div>
          </button>
        </section>

        <section className="chat-info-list">
          <button className="chat-info-list-row" onClick={onDeleteChat} type="button">
            <MediaIcon size={22} />
            <div>
              <strong>Clear chat</strong>
            </div>
          </button>
          <button className="chat-info-list-row danger-text" onClick={onBlockToggle} type="button">
            <PrivacyIcon size={22} />
            <div>
              <strong>{otherUser?.isBlocked ? `Unblock ${otherUser?.name}` : `Block ${otherUser?.name || "contact"}`}</strong>
            </div>
          </button>
          <button className="chat-info-list-row danger-text" onClick={onReport} type="button">
            <ReportIcon size={22} />
            <div>
              <strong>Report {otherUser?.name || "contact"}</strong>
              <span>{preferences.reported ? "Already reported" : "Tap to report this contact"}</span>
            </div>
          </button>
        </section>
      </div>
    </section>
  );
}

export default ChatInfoPanel;
