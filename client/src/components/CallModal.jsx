import { useEffect, useRef, useState } from "react";

import {
  AnswerCallIcon,
  CameraOffIcon,
  EndCallIcon,
  MicIcon,
  MicOffIcon,
  SpeakerIcon,
  SpeakerOffIcon,
  VideoCallIcon
} from "./AppIcons.jsx";

const formatDuration = (value) => {
  const totalSeconds = Math.max(Math.floor(value / 1000), 0);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${`${seconds}`.padStart(2, "0")}`;
};

function CallModal({
  callState,
  localStream,
  onAnswer,
  onDecline,
  onEnd,
  onToggleMic,
  onToggleRemoteAudio,
  onToggleVideo,
  remoteStream
}) {
  const [durationMs, setDurationMs] = useState(0);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);

  useEffect(() => {
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = localStream || null;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream || null;
    }

    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = remoteStream || null;
      remoteAudioRef.current.muted = Boolean(callState.isRemoteAudioMuted);
      void remoteAudioRef.current.play?.().catch(() => {});
    }
  }, [callState.isRemoteAudioMuted, remoteStream]);

  useEffect(() => {
    if (callState.phase !== "active" || !callState.connectedAt) {
      setDurationMs(0);
      return undefined;
    }

    const syncDuration = () => {
      const connectedAt = new Date(callState.connectedAt).getTime();
      setDurationMs(Date.now() - connectedAt);
    };

    syncDuration();
    const intervalId = window.setInterval(syncDuration, 1000);
    return () => window.clearInterval(intervalId);
  }, [callState.connectedAt, callState.phase]);

  const statusLabel =
    callState.phase === "incoming"
      ? callState.type === "video"
        ? "Incoming video call"
        : "Incoming audio call"
      : callState.phase === "outgoing"
        ? callState.type === "video"
          ? "Calling on video"
          : "Calling on audio"
        : callState.phase === "active"
          ? durationMs
            ? formatDuration(durationMs)
            : "Connecting..."
          : callState.type === "video"
            ? "Video call"
            : "Audio call";

  if (!callState.open) {
    return null;
  }

  return (
    <div className="settings-shell" role="dialog" aria-modal="true">
      <div className="settings-backdrop" />
      <section className="call-panel">
        <span className="eyebrow">{statusLabel}</span>
        <h2>{callState.partner?.name || "Calling"}</h2>
        <p className="muted-copy">{callState.status}</p>

        <div className="call-stream-grid">
          {callState.type === "video" ? (
            <>
              <video
                autoPlay
                className="call-video"
                muted
                playsInline
                ref={localVideoRef}
              />
              <video
                autoPlay
                className="call-video"
                muted
                playsInline
                ref={remoteVideoRef}
              />
            </>
          ) : (
            <div className="call-audio-shell">
              <span>{callState.phase === "active" ? "Audio call active" : "Voice line is ready"}</span>
              <small>{callState.isMicMuted ? "Your mic is muted" : "Your mic is on"}</small>
            </div>
          )}
        </div>

        <audio autoPlay ref={remoteAudioRef} />

        <div className="call-actions">
          {callState.phase === "incoming" ? (
            <>
              <button className="call-chip-button call-chip-success" onClick={onAnswer} type="button">
                <AnswerCallIcon size={18} />
                <span>Receive</span>
              </button>
              <button className="call-chip-button call-chip-danger" onClick={onDecline} type="button">
                <EndCallIcon size={18} />
                <span>End</span>
              </button>
            </>
          ) : (
            <>
              <button className="call-chip-button" onClick={onToggleMic} type="button">
                {callState.isMicMuted ? <MicOffIcon size={18} /> : <MicIcon size={18} />}
                <span>{callState.isMicMuted ? "Unmute" : "Mute"}</span>
              </button>
              {callState.type === "video" ? (
                <button className="call-chip-button" onClick={onToggleVideo} type="button">
                  {callState.isVideoEnabled ? <VideoCallIcon size={18} /> : <CameraOffIcon size={18} />}
                  <span>{callState.isVideoEnabled ? "Video on" : "Video off"}</span>
                </button>
              ) : null}
              <button className="call-chip-button" onClick={onToggleRemoteAudio} type="button">
                {callState.isRemoteAudioMuted ? <SpeakerOffIcon size={18} /> : <SpeakerIcon size={18} />}
                <span>{callState.isRemoteAudioMuted ? "Speaker off" : "Speaker on"}</span>
              </button>
              <button className="call-chip-button call-chip-danger" onClick={onEnd} type="button">
                <EndCallIcon size={18} />
                <span>End call</span>
              </button>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

export default CallModal;
