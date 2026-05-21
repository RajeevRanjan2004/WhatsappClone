import { useState } from "react";

import apiClient from "../api/client.js";
import { MoonIcon, SunIcon } from "../components/AppIcons.jsx";
import { useAuth } from "../context/AuthContext.jsx";

const initialForm = {
  name: "",
  email: "",
  password: ""
};

function AuthPage({ onToggleTheme, theme }) {
  const { login, register } = useAuth();
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

  const getRequestMessage = (requestError, fallbackMessage) => {
    if (requestError?.response?.data?.message) {
      return requestError.response.data.message;
    }

    if (requestError?.code === "ERR_NETWORK") {
      return "Cannot reach the server right now. Start the backend and allow this machine in MongoDB Atlas Network Access.";
    }

    return fallbackMessage;
  };

  const updateField = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value
    }));
  };

  const handleModeChange = (nextMode) => {
    setMode(nextMode);
    setError("");
    setHelper("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
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

  const handleRequestResetToken = async (event) => {
    event.preventDefault();
    setError("");
    setHelper("");
    setIsSubmitting(true);

    try {
      const response = await apiClient.post("/auth/forgot-password", {
        email: resetForm.email
      });

      setHelper(response.data.message || "Check your email for the OTP.");
    } catch (requestError) {
      setError(getRequestMessage(requestError, "Unable to start password reset."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async (event) => {
    event.preventDefault();
    setError("");
    setHelper("");
    setIsSubmitting(true);

    try {
      const response = await apiClient.post("/auth/reset-password", {
        email: resetForm.email,
        otp: resetForm.otp,
        password: resetForm.newPassword,
      });

      setHelper(response.data.message);
      setMode("login");
      setForm((current) => ({
        ...current,
        email: resetForm.email,
        password: ""
      }));
      setResetForm({
        email: resetForm.email,
        newPassword: "",
        otp: ""
      });
    } catch (requestError) {
      setError(getRequestMessage(requestError, "Unable to reset password."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-story">
        <div className="auth-story-toolbar">
          <button className="ghost-button auth-theme-toggle" onClick={onToggleTheme} type="button">
            {theme === "dark" ? <SunIcon size={18} /> : <MoonIcon size={18} />}
            <span>{theme === "dark" ? "Light mode" : "Dark mode"}</span>
          </button>
        </div>
        <h1>PulseChat</h1>
      </section>

      <section className="auth-panel">
        {mode === "choice" ? (
          <div className="auth-choice">
            <div className="auth-choice-actions">
              <button className="primary-button" onClick={() => handleModeChange("login")} type="button">
                Login
              </button>
              <button className="ghost-button" onClick={() => handleModeChange("register")} type="button">
                Sign up
              </button>
            </div>
          </div>
        ) : mode !== "forgot" ? (
          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="auth-form-topline">
              <button className="text-button" onClick={() => handleModeChange("choice")} type="button">
                Back
              </button>
            </div>

            <div className="mode-switch">
              <button
                className={mode === "register" ? "mode-active" : ""}
                onClick={() => handleModeChange("register")}
                type="button"
              >
                Sign up
              </button>
              <button
                className={mode === "login" ? "mode-active" : ""}
                onClick={() => handleModeChange("login")}
                type="button"
              >
                Login
              </button>
            </div>

            <div>
              <span className="eyebrow">{mode === "register" ? "New here?" : "Welcome back"}</span>
              <h2>{mode === "register" ? "Create your account" : "Login to continue"}</h2>
            </div>

            {mode === "register" ? (
              <label>
                <span>Name</span>
                <input
                  autoComplete="name"
                  onChange={(event) => updateField("name", event.target.value)}
                  placeholder="Enter your name"
                  required
                  type="text"
                  value={form.name}
                />
              </label>
            ) : null}

            <label>
              <span>Email</span>
              <input
                autoComplete="email"
                inputMode="email"
                onChange={(event) => updateField("email", event.target.value)}
                placeholder="you@example.com"
                required
                type="text"
                value={form.email}
              />
            </label>

            <label>
              <span>Password</span>
              <input
                autoComplete={mode === "register" ? "new-password" : "current-password"}
                minLength="6"
                onChange={(event) => updateField("password", event.target.value)}
                placeholder="At least 6 characters"
                required
                type="password"
                value={form.password}
              />
            </label>

            {error ? <p className="error-banner">{error}</p> : null}
            {helper ? <p className="helper-banner">{helper}</p> : null}

            <button className="primary-button" disabled={isSubmitting} type="submit">
              {isSubmitting ? "Please wait..." : mode === "register" ? "Create account" : "Login"}
            </button>

            {mode === "login" ? (
              <div className="auth-form-actions">
                <button className="text-button" onClick={() => handleModeChange("forgot")} type="button">
                  Forgot password?
                </button>
              </div>
            ) : null}
          </form>
        ) : (
          <div className="auth-form">
            <div className="auth-form-topline">
              <button className="text-button" onClick={() => handleModeChange("login")} type="button">
                Back
              </button>
            </div>

            <div>
              <span className="eyebrow">Recover account</span>
              <h2>Forgot password</h2>
            </div>

            <form className="inline-form" onSubmit={handleRequestResetToken}>
              <label>
                <span>Email</span>
                <input
                  inputMode="email"
                  onChange={(event) => setResetForm((current) => ({ ...current, email: event.target.value }))}
                  placeholder="you@example.com"
                  required
                  type="text"
                  value={resetForm.email}
                />
              </label>
              <button className="ghost-button" disabled={isSubmitting} type="submit">
                Send OTP
              </button>
            </form>

            <form className="inline-form" onSubmit={handleResetPassword}>
              <label>
                <span>Email OTP</span>
                <input
                  inputMode="numeric"
                  maxLength="6"
                  onChange={(event) => setResetForm((current) => ({ ...current, otp: event.target.value }))}
                  placeholder="Enter 6-digit OTP"
                  required
                  type="text"
                  value={resetForm.otp}
                />
              </label>
              <label>
                <span>New password</span>
                <input
                  minLength="6"
                  onChange={(event) => setResetForm((current) => ({ ...current, newPassword: event.target.value }))}
                  placeholder="At least 6 characters"
                  required
                  type="password"
                  value={resetForm.newPassword}
                />
              </label>
              {error ? <p className="error-banner">{error}</p> : null}
              {helper ? <p className="helper-banner">{helper}</p> : null}
              <button className="primary-button" disabled={isSubmitting} type="submit">
                Reset password
              </button>
            </form>

            <div className="auth-form-actions">
              <button className="text-button" onClick={() => handleModeChange("login")} type="button">
                Back to login
              </button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

export default AuthPage;
