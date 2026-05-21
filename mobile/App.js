import React from "react";
import { ActivityIndicator, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";

import { AuthProvider, useAuth } from "./src/context/AuthContext";
import { ThemeProvider, useTheme } from "./src/context/ThemeContext";
import AuthScreen from "./src/screens/AuthScreen";
import HomeScreen from "./src/screens/HomeScreen";

function AppContent() {
  const { isLoading, user } = useAuth();
  const { theme } = useTheme();

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.loadingScreen, { backgroundColor: theme.background }]}>
        <StatusBar style={theme.mode === "dark" ? "light" : "dark"} />
        <View style={[styles.loadingCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <ActivityIndicator color={theme.accent} size="large" />
          <Text style={[styles.loadingTitle, { color: theme.text }]}>PulseChat Mobile</Text>
          <Text style={[styles.loadingCopy, { color: theme.muted }]}>Loading your React Native workspace...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <>
      <StatusBar style={theme.mode === "dark" ? "light" : "dark"} />
      {user ? <HomeScreen /> : <AuthScreen />}
    </>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  loadingCard: {
    alignItems: "center",
    borderRadius: 28,
    borderWidth: 1,
    gap: 12,
    paddingHorizontal: 24,
    paddingVertical: 28,
    width: "100%"
  },
  loadingCopy: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center"
  },
  loadingScreen: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    padding: 24
  },
  loadingTitle: {
    fontSize: 24,
    fontWeight: "700"
  }
});
