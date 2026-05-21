import { useRef, useState } from "react";

import { CameraIcon, ClipIcon, EmojiIcon, MicIcon, SendIcon } from "./AppIcons.jsx";

function MessageComposer({ disabled, helperText, onSend }) {
  const [text, setText] = useState("");
  const [file, setFile] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const streamRef = useRef(null);

  const clearSelectedFile = () => {
    setFile(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setIsRecording(false);
  };

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      return;
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mediaRecorder = new MediaRecorder(stream);
    recordedChunksRef.current = [];
    streamRef.current = stream;
    mediaRecorderRef.current = mediaRecorder;

    mediaRecorder.addEventListener("dataavailable", (event) => {
      if (event.data.size > 0) {
        recordedChunksRef.current.push(event.data);
      }
    });

    mediaRecorder.addEventListener("stop", () => {
      if (!recordedChunksRef.current.length) {
        return;
      }

      const blob = new Blob(recordedChunksRef.current, { type: mediaRecorder.mimeType || "audio/webm" });
      const extension = blob.type.includes("ogg") ? "ogg" : "webm";
      const audioFile = new File([blob], `voice-note-${Date.now()}.${extension}`, {
        type: blob.type || "audio/webm"
      });

      setFile(audioFile);
    });

    mediaRecorder.start();
    setIsRecording(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const trimmedText = text.trim();

    if ((!trimmedText && !file) || disabled) {
      return;
    }

    const sent = await onSend({
      file,
      text: trimmedText
    });

    if (sent) {
      setText("");
      clearSelectedFile();
    }
  };

  return (
    <form className="composer" onSubmit={handleSubmit}>
      <div className="composer-main composer-main-whats">
        <div className="composer-input-shell">
          <button aria-label="Emoji" className="composer-icon-button" disabled={disabled} type="button">
            <EmojiIcon size={20} />
          </button>
          <input
            accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.txt"
            hidden
            onChange={(event) => setFile(event.target.files?.[0] || null)}
            ref={fileInputRef}
            type="file"
          />
          <button
            aria-label="Attach file"
            className="composer-icon-button"
            disabled={disabled}
            onClick={() => fileInputRef.current?.click()}
            type="button"
          >
            <ClipIcon size={19} />
          </button>
          <button aria-label="Open camera" className="composer-icon-button" disabled={disabled} type="button">
            <CameraIcon size={19} />
          </button>
          <input
            className="composer-input composer-input-whats"
            disabled={disabled}
            maxLength={2000}
            onChange={(event) => setText(event.target.value)}
            placeholder="Message"
            type="text"
            value={text}
          />
        </div>

        {file ? (
          <div className="file-pill file-pill-whats">
            <span>{file.name}</span>
            <button className="text-button" onClick={clearSelectedFile} type="button">
              Remove
            </button>
          </div>
        ) : null}

        {helperText ? <span className="composer-helper">{helperText}</span> : null}
      </div>

      <button
        aria-label={text.trim() || file ? "Send message" : isRecording ? "Stop voice note" : "Record voice note"}
        className={`composer-fab ${isRecording ? "composer-fab-recording" : ""}`}
        disabled={disabled}
        onClick={text.trim() || file ? undefined : isRecording ? stopRecording : startRecording}
        type={text.trim() || file ? "submit" : "button"}
      >
        {text.trim() || file ? <SendIcon size={20} /> : <MicIcon size={20} />}
      </button>
    </form>
  );
}

export default MessageComposer;
