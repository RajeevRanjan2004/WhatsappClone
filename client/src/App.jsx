import { useAuth } from "./context/AuthContext.jsx";
import AuthPage from "./pages/AuthPage.jsx";
import ChatPage from "./pages/ChatPage.jsx";
import { useEffect, useState } from "react";

const themeStorageKey = "pulsechat-theme";

function App() {
  const { user, isLoading } = useAuth();
  const [theme, setTheme] = useState(() => window.localStorage.getItem(themeStorageKey) || "dark");

  useEffect(() => {
    document.body.dataset.theme = theme;
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem(themeStorageKey, theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  };

  if (isLoading) {
    return (
      <main className="loading-screen">
        <div className="loading-card">
          <span className="eyebrow">Android-friendly MERN chat</span>
          <h1>PulseChat</h1>
          <p>Loading your conversations...</p>
        </div>
      </main>
    );
  }

  return user ? <ChatPage onToggleTheme={toggleTheme} theme={theme} /> : <AuthPage onToggleTheme={toggleTheme} theme={theme} />;
}

export default App;
