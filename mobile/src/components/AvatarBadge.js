import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";

import { resolveAssetUrl } from "../api/client";
import { getInitials } from "../utils/chat";

export default function AvatarBadge({ size = 48, user }) {
  const avatarUrl = resolveAssetUrl(user?.avatarUrl || "");
  const initials = getInitials(user?.name || "PulseChat");

  return (
    <View
      style={[
        styles.shell,
        {
          backgroundColor: user?.avatarColor || "#128c7e",
          borderRadius: size / 2,
          height: size,
          width: size
        }
      ]}
    >
      {avatarUrl ? (
        <Image source={{ uri: avatarUrl }} style={{ borderRadius: size / 2, height: size, width: size }} />
      ) : (
        <Text style={[styles.copy, { fontSize: Math.max(14, size * 0.34) }]}>{initials}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  copy: {
    color: "#ffffff",
    fontWeight: "700"
  },
  shell: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden"
  }
});
