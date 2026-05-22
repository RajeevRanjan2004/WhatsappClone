import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { RTCView } from "react-native-webrtc";

import AvatarBadge from "./AvatarBadge";

export default function CallModal({
  callState,
  localStream,
  onAnswer,
  onDecline,
  onEnd,
  onToggleMic,
  onToggleSpeaker,
  onToggleVideo,
  remoteStream,
  theme,
  visible
}) {
  if (!visible) {
    return null;
  }

  const localStreamUrl = localStream?.toURL?.() || "";
  const remoteStreamUrl = remoteStream?.toURL?.() || "";
  const isIncoming = callState.phase === "incoming";
  const isVideoCall = callState.type === "video";
  const showRemoteVideo = Boolean(isVideoCall && remoteStreamUrl);
  const showLocalPreview = Boolean(isVideoCall && localStreamUrl);

  return (
    <Modal animationType="fade" onRequestClose={isIncoming ? onDecline : onEnd} transparent visible={visible}>
      <View style={styles.shell}>
        <View style={[styles.backdrop, { backgroundColor: theme.overlay }]} />
        <View style={[styles.panel, { backgroundColor: theme.card, borderColor: theme.border }]}>
          {showRemoteVideo ? <RTCView mirror={false} objectFit="cover" streamURL={remoteStreamUrl} style={styles.remoteVideo} /> : null}

          <View style={styles.content}>
            {!showRemoteVideo ? (
              <View style={styles.avatarShell}>
                <AvatarBadge size={92} user={callState.partner} />
              </View>
            ) : null}

            <Text numberOfLines={1} style={[styles.partnerName, { color: theme.text }]}>
              {callState.partner?.name || "Calling"}
            </Text>
            <Text style={[styles.statusCopy, { color: theme.muted }]}>
              {callState.status || (isIncoming ? "Incoming call" : "Connecting...")}
            </Text>

            {showLocalPreview ? (
              <View style={[styles.localPreviewShell, { borderColor: theme.border, backgroundColor: theme.panelSoft }]}>
                <RTCView mirror objectFit="cover" streamURL={localStreamUrl} style={styles.localPreview} />
              </View>
            ) : null}

            <View style={styles.actions}>
              {isIncoming ? (
                <>
                  <Pressable onPress={onDecline} style={[styles.actionButton, styles.endButton]}>
                    <MaterialCommunityIcons color="#ffffff" name="phone-hangup" size={22} />
                    <Text style={styles.actionCopy}>End</Text>
                  </Pressable>
                  <Pressable onPress={onAnswer} style={[styles.actionButton, styles.answerButton]}>
                    <MaterialCommunityIcons color="#081317" name="phone-check" size={22} />
                    <Text style={[styles.actionCopy, styles.answerCopy]}>Receive</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Pressable onPress={onToggleMic} style={[styles.actionButton, { backgroundColor: theme.panelSoft }]}>
                    <Ionicons color={theme.text} name={callState.isMicMuted ? "mic-off" : "mic"} size={22} />
                    <Text style={[styles.actionCopy, { color: theme.text }]}>{callState.isMicMuted ? "Unmute" : "Mute"}</Text>
                  </Pressable>

                  <Pressable onPress={onToggleSpeaker} style={[styles.actionButton, { backgroundColor: theme.panelSoft }]}>
                    <Ionicons color={theme.text} name={callState.isSpeakerOn ? "volume-high" : "ear-outline"} size={22} />
                    <Text style={[styles.actionCopy, { color: theme.text }]}>
                      {callState.isSpeakerOn ? "Speaker" : "Earpiece"}
                    </Text>
                  </Pressable>

                  {isVideoCall ? (
                    <Pressable onPress={onToggleVideo} style={[styles.actionButton, { backgroundColor: theme.panelSoft }]}>
                      <Ionicons
                        color={theme.text}
                        name={callState.isVideoEnabled ? "videocam" : "videocam-off"}
                        size={22}
                      />
                      <Text style={[styles.actionCopy, { color: theme.text }]}>
                        {callState.isVideoEnabled ? "Video on" : "Video off"}
                      </Text>
                    </Pressable>
                  ) : null}

                  <Pressable onPress={onEnd} style={[styles.actionButton, styles.endButton]}>
                    <MaterialCommunityIcons color="#ffffff" name="phone-hangup" size={22} />
                    <Text style={styles.actionCopy}>End</Text>
                  </Pressable>
                </>
              )}
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  actionButton: {
    alignItems: "center",
    borderRadius: 999,
    gap: 8,
    justifyContent: "center",
    minWidth: 88,
    paddingHorizontal: 18,
    paddingVertical: 16
  },
  actionCopy: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700"
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
    justifyContent: "center",
    marginTop: 18
  },
  answerButton: {
    backgroundColor: "#25d366"
  },
  answerCopy: {
    color: "#081317"
  },
  avatarShell: {
    marginBottom: 14
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject
  },
  content: {
    alignItems: "center",
    flex: 1,
    justifyContent: "flex-end",
    padding: 24,
    paddingBottom: 40
  },
  endButton: {
    backgroundColor: "#d94a4a"
  },
  localPreview: {
    borderRadius: 18,
    flex: 1
  },
  localPreviewShell: {
    borderRadius: 20,
    borderWidth: 1,
    height: 144,
    overflow: "hidden",
    position: "absolute",
    right: 16,
    top: 16,
    width: 104
  },
  panel: {
    borderRadius: 32,
    borderWidth: 1,
    flex: 1,
    margin: 16,
    overflow: "hidden"
  },
  partnerName: {
    fontSize: 32,
    fontWeight: "800",
    marginBottom: 8,
    textAlign: "center"
  },
  remoteVideo: {
    ...StyleSheet.absoluteFillObject
  },
  shell: {
    flex: 1,
    justifyContent: "center"
  },
  statusCopy: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center"
  }
});
