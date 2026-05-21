import { createContext, useContext, useEffect, useState } from "react";

import apiClient, { setAuthToken } from "../api/client.js";

const AuthContext = createContext(null);
const storageKey = "pulsechat-auth";

const readSession = () => {
  const currentWindowSession = window.sessionStorage.getItem(storageKey);

  if (currentWindowSession) {
    return currentWindowSession;
  }

  const legacySharedSession = window.localStorage.getItem(storageKey);

  if (legacySharedSession) {
    window.sessionStorage.setItem(storageKey, legacySharedSession);
    window.localStorage.removeItem(storageKey);
    return legacySharedSession;
  }

  return null;
};

const persistSession = (token, user) => {
  window.sessionStorage.setItem(storageKey, JSON.stringify({ token, user }));
};

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const clearSession = () => {
    setToken(null);
    setUser(null);
    setAuthToken(null);
    window.sessionStorage.removeItem(storageKey);
    window.localStorage.removeItem(storageKey);
  };

  useEffect(() => {
    const savedSession = readSession();

    if (!savedSession) {
      setIsLoading(false);
      return;
    }

    try {
      const parsedSession = JSON.parse(savedSession);

      if (!parsedSession?.token) {
        setIsLoading(false);
        return;
      }

      setToken(parsedSession.token);
      setUser(parsedSession.user || null);
      setAuthToken(parsedSession.token);
    } catch {
      clearSession();
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!token) {
      setIsLoading(false);
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
        persistSession(token, response.data.user);
      } catch {
        if (!ignore) {
          clearSession();
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    };

    hydrateUser();

    return () => {
      ignore = true;
    };
  }, [token]);

  const authenticate = async (mode, payload) => {
    const response = await apiClient.post(`/auth/${mode}`, payload);

    setToken(response.data.token);
    setUser(response.data.user);
    setAuthToken(response.data.token);
    persistSession(response.data.token, response.data.user);

    return response.data.user;
  };

  const login = (payload) => authenticate("login", payload);
  const register = (payload) => authenticate("register", payload);
  const setCurrentUser = (nextUser) => {
    setUser(nextUser);

    if (token && nextUser) {
      persistSession(token, nextUser);
    }
  };

  const logout = () => {
    clearSession();
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
