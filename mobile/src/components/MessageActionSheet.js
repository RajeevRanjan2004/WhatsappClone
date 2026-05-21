import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

export default function MessageActionSheet({
  canDeleteForEveryone,
  message,
  onClose,
  onCopy,
  onDeleteForEveryone,
  onDeleteForSelf,
  onShare,
  theme,
  visible
}) {
  const canCopyOrShare = Boolean(message) && !message?.isDeleted;

  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.shell}>
        <Pressable style={[styles.backdrop, { backgroundColor: theme.overlay }]} onPress={onClose} />
        <View style={[styles.panel, { backgroundColor: theme.panel, borderColor: theme.border }]}>
          <View style={styles.heading}>
            <Text style={[styles.title, { color: theme.text }]}>Message options</Text>
            <Text style={[styles.subtitle, { color: theme.muted }]}>Tap an action to continue</Text>
          </View>

          {canCopyOrShare ? (
            <>
              <Pressable style={styles.option} onPress={onCopy}>
                <Text style={[styles.optionCopy, { color: theme.text }]}>Copy</Text>
              </Pressable>
              <Pressable style={styles.option} onPress={onShare}>
                <Text style={[styles.optionCopy, { color: theme.text }]}>Share</Text>
              </Pressable>
            </>
          ) : null}

          <Pressable style={styles.option} onPress={onDeleteForSelf}>
            <Text style={[styles.optionCopy, { color: theme.text }]}>Delete for myself</Text>
          </Pressable>

          {canDeleteForEveryone ? (
            <Pressable style={styles.option} onPress={onDeleteForEveryone}>
              <Text style={[styles.optionCopy, { color: theme.danger }]}>Delete for everyone</Text>
            </Pressable>
          ) : null}

          <Pressable style={styles.option} onPress={onClose}>
            <Text style={[styles.optionCopy, { color: theme.muted }]}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject
  },
  heading: {
    gap: 4,
    paddingBottom: 8
  },
  option: {
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14
  },
  optionCopy: {
    fontSize: 16,
    fontWeight: "700"
  },
  panel: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    bottom: 0,
    gap: 2,
    left: 0,
    paddingHorizontal: 10,
    paddingTop: 14,
    position: "absolute",
    right: 0
  },
  shell: {
    flex: 1,
    justifyContent: "flex-end"
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20
  },
  title: {
    fontSize: 18,
    fontWeight: "700"
  }
});
