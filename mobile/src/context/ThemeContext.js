import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { themes } from "../theme/palette";

const ThemeContext = createContext(null);
const storageKey = "pulsechat-rn-theme";

export function ThemeProvider({ children }) {
  const [themeName, setThemeName] = useState("dark");
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let ignore = false;

    const loadTheme = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem(storageKey);

        if (!ignore && savedTheme && themes[savedTheme]) {
          setThemeName(savedTheme);
        }
      } finally {
        if (!ignore) {
          setIsReady(true);
        }
      }
    };

    void loadTheme();

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    void AsyncStorage.setItem(storageKey, themeName);
  }, [isReady, themeName]);

  const toggleTheme = () => {
    setThemeName((current) => (current === "dark" ? "light" : "dark"));
  };

  return (
    <ThemeContext.Provider
      value={{
        isReady,
        setThemeName,
        theme: themes[themeName],
        themeName,
        toggleTheme
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used inside ThemeProvider");
  }

  return context;
};
