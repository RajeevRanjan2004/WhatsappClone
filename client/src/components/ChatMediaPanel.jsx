import { BackIcon, MediaIcon, StorageIcon } from "./AppIcons.jsx";
import { resolveAssetUrl } from "../utils/assets.js";
import {
  formatBytes,
  formatMessageDay,
  formatMessageTime,
  getConversationTitle
} from "../utils/chat.js";

function ChatMediaPanel({ conversation, currentUserId, isOpen, messages, onClose }) {
  if (!isOpen || !conversation) {
    return null;
  }

  const attachments = messages
    .filter((message) => !message.isDeleted)
    .flatMap((message) =>
      (message.attachments || []).map((attachment) => ({
        ...attachment,
        createdAt: message.createdAt,
        messageId: message._id
      }))
    )
    .reverse();

  const totalSize = attachments.reduce((sum, attachment) => sum + (attachment.size || 0), 0);
  const counts = attachments.reduce(
    (summary, attachment) => ({
      ...summary,
      [attachment.kind]: (summary[attachment.kind] || 0) + 1
    }),
    { audio: 0, file: 0, image: 0, video: 0 }
  );

  const renderPreview = (attachment) => {
    if (attachment.kind === "image") {
      return <img alt={attachment.originalName} className="chat-media-thumb" src={resolveAssetUrl(attachment.url)} />;
    }

    if (attachment.kind === "video") {
      return (
        <video className="chat-media-thumb" controls preload="metadata">
          <source src={resolveAssetUrl(attachment.url)} type={attachment.mimeType} />
        </video>
      );
    }

    return (
      <div className="chat-media-glyph">
        <MediaIcon size={20} />
        <span>{attachment.kind === "audio" ? "Audio" : "Doc"}</span>
      </div>
    );
  };

  return (
    <div aria-modal="true" className="settings-shell" role="dialog">
      <button aria-label="Close media details" className="settings-backdrop" onClick={onClose} type="button" />

      <section className="settings-panel chat-media-panel">
        <header className="chat-media-panel-header">
          <button aria-label="Back" className="icon-button chat-media-icon-button" onClick={onClose} type="button">
            <BackIcon />
          </button>

          <div>
            <span className="eyebrow">This chat</span>
            <h2>{getConversationTitle(conversation, currentUserId)}</h2>
          </div>
        </header>

        <section className="chat-media-summary">
          <div className="chat-media-summary-card">
            <StorageIcon size={20} />
            <div>
              <strong>{formatBytes(totalSize)}</strong>
              <span>Shared storage in this chat</span>
            </div>
          </div>

          <div className="chat-media-summary-grid">
            <div>
              <strong>{counts.image}</strong>
              <span>Photos</span>
            </div>
            <div>
              <strong>{counts.video}</strong>
              <span>Videos</span>
            </div>
            <div>
              <strong>{counts.audio}</strong>
              <span>Audio</span>
            </div>
            <div>
              <strong>{counts.file}</strong>
              <span>Docs</span>
            </div>
          </div>
        </section>

        <section className="chat-media-list">
          {attachments.length ? (
            attachments.map((attachment) => (
              <a
                className="chat-media-card"
                href={resolveAssetUrl(attachment.url)}
                key={`${attachment.messageId}-${attachment.url}`}
                rel="noreferrer"
                target="_blank"
              >
                {renderPreview(attachment)}
                <div className="chat-media-copy">
                  <strong>{attachment.originalName}</strong>
                  <span>
                    {attachment.kind.charAt(0).toUpperCase() + attachment.kind.slice(1)} | {formatBytes(attachment.size || 0)}
                  </span>
                  <span>
                    {formatMessageDay(attachment.createdAt)} at {formatMessageTime(attachment.createdAt)}
                  </span>
                </div>
              </a>
            ))
          ) : (
            <div className="whats-empty-state">
              <strong>No shared media yet</strong>
              <span>Photos, videos, audio, and documents from this chat will appear here.</span>
            </div>
          )}
        </section>
      </section>
    </div>
  );
}

export default ChatMediaPanel;
