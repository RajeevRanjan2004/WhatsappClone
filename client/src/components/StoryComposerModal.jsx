import { useRef, useState } from "react";

function StoryComposerModal({ isOpen, onClose, onCreateStory }) {
  const [caption, setCaption] = useState("");
  const [text, setText] = useState("");
  const [file, setFile] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef(null);

  if (!isOpen) {
    return null;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      await onCreateStory({
        caption,
        file,
        text
      });
      setCaption("");
      setText("");
      setFile(null);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="settings-shell" role="dialog" aria-modal="true">
      <button aria-label="Close story creator" className="settings-backdrop" onClick={onClose} type="button" />
      <section className="settings-panel">
        <div className="settings-header">
          <div>
            <span className="eyebrow">Status</span>
            <h2>Create a story</h2>
          </div>
          <button className="ghost-button" onClick={onClose} type="button">
            Close
          </button>
        </div>

        <form className="settings-section" onSubmit={handleSubmit}>
          <label>
            <span>Text</span>
            <input onChange={(event) => setText(event.target.value)} placeholder="Write a short status" type="text" value={text} />
          </label>
          <label>
            <span>Caption</span>
            <input onChange={(event) => setCaption(event.target.value)} type="text" value={caption} />
          </label>
          <label className="settings-upload">
            <span>Photo or video</span>
            <input accept="image/*,video/*" onChange={(event) => setFile(event.target.files?.[0] || null)} ref={fileInputRef} type="file" />
          </label>
          <button className="primary-button" disabled={isSubmitting || (!text.trim() && !file)} type="submit">
            {isSubmitting ? "Posting..." : "Post status"}
          </button>
        </form>
      </section>
    </div>
  );
}

export default StoryComposerModal;
