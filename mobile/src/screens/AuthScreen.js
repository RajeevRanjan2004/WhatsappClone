import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";

import apiClient from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

const initialForm = {
  email: "",
  name: "",
  password: ""
};

export default function AuthScreen() {
  const { login, register } = useAuth();
  const { theme, themeName, toggleTheme } = useTheme();
  const [mode, setMode] = useState("choice");
  const [form, setForm] = useState(initialForm);
  const [resetForm, setResetForm] = useState({
    email: "",
    newPassword: "",
    otp: ""
  });
  const [error, setError] = useState("");
  const [helper, setHelper] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const styles = createStyles(theme);

  const getRequestMessage = (requestError, fallbackMessage) => {
    if (requestError?.response?.data?.message) {
      return requestError.response.data.message;
    }

    if (requestError?.code === "ERR_NETWORK") {
      return "Server reach nahi ho raha. Expo public URL ya backend URL check karo.";
    }

    return fallbackMessage;
  };

  const handleModeChange = (nextMode) => {
    setMode(nextMode);
    setError("");
    setHelper("");
  };

  const updateField = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value
    }));
  };

  const handleSubmit = async () => {
    setError("");
    setHelper("");
    setIsSubmitting(true);

    try {
      if (mode === "register") {
        await register(form);
      } else {
        await login({
          email: form.email,
          password: form.password
        });
      }
    } catch (requestError) {
      setError(getRequestMessage(requestError, "Unable to continue right now."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRequestResetToken = async () => {
    setError("");
    setHelper("");
    setIsSubmitting(true);

    try {
      const response = await apiClient.post("/auth/forgot-password", {
        email: resetForm.email
      });

      setHelper(response.data.message || "OTP sent to your email.");
    } catch (requestError) {
      setError(getRequestMessage(requestError, "Unable to start password reset."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async () => {
    setError("");
    setHelper("");
    setIsSubmitting(true);

    try {
      const response = await apiClient.post("/auth/reset-password", {
        email: resetForm.email,
        otp: resetForm.otp,
        password: resetForm.newPassword
      });

      setHelper(response.data.message);
      setMode("login");
      setForm((current) => ({
        ...current,
        email: resetForm.email,
        password: ""
      }));
      setResetForm((current) => ({
        ...current,
        newPassword: "",
        otp: ""
      }));
    } catch (requestError) {
      setError(getRequestMessage(requestError, "Unable to reset password."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.brandBlock}>
            <Pressable onPress={toggleTheme} style={styles.themeButton}>
              <Text style={styles.themeButtonCopy}>{themeName === "dark" ? "Light mode" : "Dark mode"}</Text>
            </Pressable>
            <Text style={styles.brandTitle}>PulseChat Mobile</Text>
            <Text style={styles.brandCopy}>React Native app jo same backend, auth, chats aur realtime sync use karta hai.</Text>
          </View>

          <View style={styles.card}>
            {mode === "choice" ? (
              <View style={styles.choiceShell}>
                <Pressable onPress={() => handleModeChange("login")} style={styles.primaryButton}>
                  <Text style={styles.primaryButtonCopy}>Login</Text>
                </Pressable>
                <Pressable onPress={() => handleModeChange("register")} style={styles.secondaryButton}>
                  <Text style={styles.secondaryButtonCopy}>Sign up</Text>
                </Pressable>
              </View>
            ) : mode !== "forgot" ? (
              <View style={styles.formShell}>
                <Pressable onPress={() => handleModeChange("choice")}>
                  <Text style={styles.link}>Back</Text>
                </Pressable>

                <View style={styles.switchRow}>
                  <Pressable
                    onPress={() => handleModeChange("register")}
                    style={[styles.switchButton, mode === "register" ? styles.switchButtonActive : null]}
                  >
                    <Text style={[styles.switchCopy, mode === "register" ? styles.switchCopyActive : null]}>Sign up</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => handleModeChange("login")}
                    style={[styles.switchButton, mode === "login" ? styles.switchButtonActive : null]}
                  >
                    <Text style={[styles.switchCopy, mode === "login" ? styles.switchCopyActive : null]}>Login</Text>
                  </Pressable>
                </View>

                <Text style={styles.formTitle}>{mode === "register" ? "Create your account" : "Login to continue"}</Text>

                {mode === "register" ? (
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Name</Text>
                    <TextInput
                      onChangeText={(value) => updateField("name", value)}
                      placeholder="Enter your name"
                      placeholderTextColor={theme.muted}
                      style={styles.input}
                      value={form.name}
                    />
                  </View>
                ) : null}

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Email</Text>
                  <TextInput
                    autoCapitalize="none"
                    keyboardType="email-address"
                    onChangeText={(value) => updateField("email", value)}
                    placeholder="you@example.com"
                    placeholderTextColor={theme.muted}
                    style={styles.input}
                    value={form.email}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Password</Text>
                  <TextInput
                    onChangeText={(value) => updateField("password", value)}
                    placeholder="At least 6 characters"
                    placeholderTextColor={theme.muted}
                    secureTextEntry
                    style={styles.input}
                    value={form.password}
                  />
                </View>

                {error ? <Text style={styles.errorBanner}>{error}</Text> : null}
                {helper ? <Text style={styles.helperBanner}>{helper}</Text> : null}

                <Pressable onPress={handleSubmit} style={styles.primaryButton}>
                  <Text style={styles.primaryButtonCopy}>
                    {isSubmitting ? "Please wait..." : mode === "register" ? "Create account" : "Login"}
                  </Text>
                </Pressable>

                {mode === "login" ? (
                  <Pressable onPress={() => handleModeChange("forgot")}>
                    <Text style={styles.link}>Forgot password?</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : (
              <View style={styles.formShell}>
                <Pressable onPress={() => handleModeChange("login")}>
                  <Text style={styles.link}>Back</Text>
                </Pressable>

                <Text style={styles.formTitle}>Forgot password</Text>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Email</Text>
                  <TextInput
                    autoCapitalize="none"
                    keyboardType="email-address"
                    onChangeText={(value) => setResetForm((current) => ({ ...current, email: value }))}
                    placeholder="you@example.com"
                    placeholderTextColor={theme.muted}
                    style={styles.input}
                    value={resetForm.email}
                  />
                </View>

                <Pressable onPress={handleRequestResetToken} style={styles.secondaryButton}>
                  <Text style={styles.secondaryButtonCopy}>{isSubmitting ? "Sending..." : "Send OTP"}</Text>
                </Pressable>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Email OTP</Text>
                  <TextInput
                    keyboardType="number-pad"
                    maxLength={6}
                    onChangeText={(value) => setResetForm((current) => ({ ...current, otp: value }))}
                    placeholder="Enter 6-digit OTP"
                    placeholderTextColor={theme.muted}
                    style={styles.input}
                    value={resetForm.otp}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>New password</Text>
                  <TextInput
                    onChangeText={(value) => setResetForm((current) => ({ ...current, newPassword: value }))}
                    placeholder="At least 6 characters"
                    placeholderTextColor={theme.muted}
                    secureTextEntry
                    style={styles.input}
                    value={resetForm.newPassword}
                  />
                </View>

                {error ? <Text style={styles.errorBanner}>{error}</Text> : null}
                {helper ? <Text style={styles.helperBanner}>{helper}</Text> : null}

                <Pressable onPress={handleResetPassword} style={styles.primaryButton}>
                  <Text style={styles.primaryButtonCopy}>{isSubmitting ? "Please wait..." : "Reset password"}</Text>
                </Pressable>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (theme) =>
  StyleSheet.create({
    brandBlock: {
      gap: 10
    },
    brandCopy: {
      color: theme.muted,
      fontSize: 16,
      lineHeight: 24
    },
    brandTitle: {
      color: theme.text,
      fontSize: 34,
      fontWeight: "800"
    },
    card: {
      backgroundColor: theme.card,
      borderColor: theme.border,
      borderRadius: 30,
      borderWidth: 1,
      padding: 18
    },
    choiceShell: {
      gap: 12,
      minHeight: 280,
      justifyContent: "center"
    },
    content: {
      flexGrow: 1,
      gap: 22,
      justifyContent: "center",
      padding: 20
    },
    errorBanner: {
      backgroundColor: "rgba(255, 107, 107, 0.12)",
      borderRadius: 16,
      color: theme.danger,
      paddingHorizontal: 14,
      paddingVertical: 12
    },
    flex: {
      flex: 1
    },
    formShell: {
      gap: 14
    },
    formTitle: {
      color: theme.text,
      fontSize: 26,
      fontWeight: "800"
    },
    helperBanner: {
      backgroundColor: theme.accentSoft,
      borderRadius: 16,
      color: theme.text,
      paddingHorizontal: 14,
      paddingVertical: 12
    },
    input: {
      backgroundColor: theme.input,
      borderColor: theme.border,
      borderRadius: 18,
      borderWidth: 1,
      color: theme.text,
      fontSize: 16,
      paddingHorizontal: 16,
      paddingVertical: 14
    },
    inputGroup: {
      gap: 8
    },
    inputLabel: {
      color: theme.muted,
      fontSize: 14,
      fontWeight: "700"
    },
    link: {
      color: theme.accent,
      fontSize: 15,
      fontWeight: "700"
    },
    primaryButton: {
      alignItems: "center",
      backgroundColor: theme.accent,
      borderRadius: 18,
      paddingHorizontal: 16,
      paddingVertical: 15
    },
    primaryButtonCopy: {
      color: theme.mode === "dark" ? "#081317" : "#ffffff",
      fontSize: 16,
      fontWeight: "800"
    },
    screen: {
      backgroundColor: theme.background,
      flex: 1
    },
    secondaryButton: {
      alignItems: "center",
      backgroundColor: theme.panelSoft,
      borderRadius: 18,
      paddingHorizontal: 16,
      paddingVertical: 15
    },
    secondaryButtonCopy: {
      color: theme.text,
      fontSize: 16,
      fontWeight: "700"
    },
    switchButton: {
      borderRadius: 999,
      flex: 1,
      paddingVertical: 12
    },
    switchButtonActive: {
      backgroundColor: theme.card
    },
    switchCopy: {
      color: theme.muted,
      fontSize: 15,
      fontWeight: "700",
      textAlign: "center"
    },
    switchCopyActive: {
      color: theme.text
    },
    switchRow: {
      backgroundColor: theme.panelSoft,
      borderRadius: 999,
      flexDirection: "row",
      padding: 4
    },
    themeButton: {
      alignSelf: "flex-start",
      backgroundColor: theme.panelSoft,
      borderRadius: 999,
      paddingHorizontal: 14,
      paddingVertical: 10
    },
    themeButtonCopy: {
      color: theme.text,
      fontSize: 14,
      fontWeight: "700"
    }
  });
