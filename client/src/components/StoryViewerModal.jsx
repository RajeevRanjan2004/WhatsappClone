import { useEffect, useState } from "react";

import AttachmentView from "./AttachmentView.jsx";

function StoryViewerModal({ isOpen, onClose, onViewed, storyGroup }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setIndex(0);
    }
  }, [isOpen, storyGroup?.author?._id]);

  const activeStory = storyGroup?.stories?.[index] || null;

  useEffect(() => {
    if (isOpen && activeStory?._id) {
      onViewed(activeStory._id);
    }
  }, [activeStory?._id, isOpen, onViewed]);

  if (!isOpen || !storyGroup?.stories?.length) {
    return null;
  }

  return (
    <div className="settings-shell" role="dialog" aria-modal="true">
      <button aria-label="Close story viewer" className="settings-backdrop" onClick={onClose} type="button" />
      <section className="story-viewer">
        <div className="settings-header">
          <div>
            <span className="eyebrow">{storyGroup.author.name}</span>
            <h2>Status</h2>
          </div>
          <button className="ghost-button" onClick={onClose} type="button">
            Close
          </button>
        </div>

        <div className="story-viewer-body">
          {activeStory.kind === "text" ? <p className="story-text-panel">{activeStory.text}</p> : null}
          {activeStory.mediaUrl ? (
            <AttachmentView
              attachment={{
                kind: activeStory.kind,
                mimeType: activeStory.mediaMimeType,
                originalName: "Story media",
                size: 0,
                url: activeStory.mediaUrl
              }}
            />
          ) : null}
          {activeStory.caption ? <p className="story-caption">{activeStory.caption}</p> : null}
        </div>

        <div className="story-viewer-actions">
          <button
            className="ghost-button"
            disabled={index === 0}
            onClick={() => {
              setIndex(index - 1);
            }}
            type="button"
          >
            Previous
          </button>
          <button
            className="ghost-button"
            disabled={index === storyGroup.stories.length - 1}
            onClick={() => {
              setIndex(index + 1);
            }}
            type="button"
          >
            Next
          </button>
        </div>
      </section>
    </div>
  );
}

export default StoryViewerModal;
