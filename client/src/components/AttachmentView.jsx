import { formatBytes } from "../utils/chat.js";
import { resolveAssetUrl } from "../utils/assets.js";

function AttachmentView({ attachment }) {
  const assetUrl = resolveAssetUrl(attachment.url);

  if (attachment.kind === "image") {
    return (
      <a className="media-card" href={assetUrl} rel="noreferrer" target="_blank">
        <img alt={attachment.originalName} className="message-image" src={assetUrl} />
      </a>
    );
  }

  if (attachment.kind === "video") {
    return (
      <video className="message-video" controls preload="metadata">
        <source src={assetUrl} type={attachment.mimeType} />
      </video>
    );
  }

  if (attachment.kind === "audio") {
    return (
      <div className="audio-card">
        <audio className="message-audio" controls preload="metadata">
          <source src={assetUrl} type={attachment.mimeType} />
        </audio>
        <span>{formatBytes(attachment.size)}</span>
      </div>
    );
  }

  return (
    <a className="file-card" href={assetUrl} rel="noreferrer" target="_blank">
      <strong>{attachment.originalName}</strong>
      <span>
        {attachment.mimeType} - {formatBytes(attachment.size)}
      </span>
    </a>
  );
}

export default AttachmentView;
