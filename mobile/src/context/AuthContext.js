import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

import apiClient, { setAuthToken } from "../api/client";

const AuthContext = createContext(null);
const storageKey = "pulsechat-rn-auth";

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const clearSession = async () => {
    setToken(null);
    setUser(null);
    setAuthToken(null);
    await AsyncStorage.removeItem(storageKey);
  };

  useEffect(() => {
    let ignore = false;

    const restoreSession = async () => {
      try {
        const savedSession = await AsyncStorage.getItem(storageKey);

        if (!savedSession) {
          return;
        }

        const parsedSession = JSON.parse(savedSession);

        if (parsedSession?.token) {
          setToken(parsedSession.token);
          setUser(parsedSession.user || null);
          setAuthToken(parsedSession.token);
        }
      } catch {
        await clearSession();
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    };

    void restoreSession();

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (!token) {
      return;
    }

    let ignore = false;

    const hydrateUser = async () => {
      try {
        const response = await apiClient.get("/auth/me");

        if (ignore) {
          return;
        }

        setUser(response.data.user);
        await AsyncStorage.setItem(
          storageKey,
          JSON.stringify({
            token,
            user: response.data.user
          })
        );
      } catch {
        if (!ignore) {
          await clearSession();
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    };

    void hydrateUser();

    return () => {
      ignore = true;
    };
  }, [token]);

  const authenticate = async (mode, payload) => {
    const response = await apiClient.post(`/auth/${mode}`, payload);

    setToken(response.data.token);
    setUser(response.data.user);
    setAuthToken(response.data.token);
    await AsyncStorage.setItem(
      storageKey,
      JSON.stringify({
        token: response.data.token,
        user: response.data.user
      })
    );

    return response.data.user;
  };

  const login = (payload) => authenticate("login", payload);
  const register = (payload) => authenticate("register", payload);
  const setCurrentUser = async (nextUser) => {
    setUser(nextUser);

    if (token && nextUser) {
      await AsyncStorage.setItem(
        storageKey,
        JSON.stringify({
          token,
          user: nextUser
        })
      );
    }
  };
  const logout = async () => {
    await clearSession();
    setIsLoading(false);
  };

  return (
    <AuthContext.Provider
      value={{
        isLoading,
        login,
        logout,
        register,
        setCurrentUser,
        token,
        user
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
};
