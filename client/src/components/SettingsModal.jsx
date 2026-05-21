import { useEffect, useState } from "react";

import AvatarBadge from "./AvatarBadge.jsx";

function SettingsModal({
  blockedUsers,
  isOpen,
  onChangePassword,
  onClose,
  onSaveProfile,
  onUnblock,
  onUploadAvatar,
  user
}) {
  const [name, setName] = useState(user?.name || "");
  const [about, setAbout] = useState(user?.about || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  useEffect(() => {
    setName(user?.name || "");
    setAbout(user?.about || "");
  }, [user]);

  if (!isOpen) {
    return null;
  }

  const handleProfileSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setFeedback("");
    setIsSavingProfile(true);

    try {
      await onSaveProfile({ about, name });
      setFeedback("Profile updated.");
    } catch (requestError) {
      setError(requestError.message || "Unable to update profile.");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleAvatarChange = async (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setError("");
    setFeedback("");
    setIsUploadingAvatar(true);

    try {
      await onUploadAvatar(file);
      setFeedback("Profile photo updated.");
    } catch (requestError) {
      setError(requestError.message || "Unable to upload profile photo.");
    } finally {
      setIsUploadingAvatar(false);
      event.target.value = "";
    }
  };

  const handlePasswordSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setFeedback("");
    setIsChangingPassword(true);

    try {
      await onChangePassword({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setFeedback("Password changed.");
    } catch (requestError) {
      setError(requestError.message || "Unable to change password.");
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div className="settings-shell" role="dialog" aria-modal="true">
      <button aria-label="Close settings" className="settings-backdrop" onClick={onClose} type="button" />
      <section className="settings-panel">
        <div className="settings-header">
          <div>
            <span className="eyebrow">Settings</span>
            <h2>Profile and privacy</h2>
          </div>
          <button className="ghost-button" onClick={onClose} type="button">
            Close
          </button>
        </div>

        {error ? <div className="error-banner">{error}</div> : null}
        {feedback ? <div className="helper-banner">{feedback}</div> : null}

        <section className="settings-section">
          <div className="settings-avatar-row">
            <AvatarBadge size="md" user={user} />
            <div>
              <strong>{user?.name}</strong>
              <span>{user?.email}</span>
            </div>
          </div>
          <label className="settings-upload">
            <span>Profile photo</span>
            <input accept="image/*" disabled={isUploadingAvatar} onChange={handleAvatarChange} type="file" />
          </label>
        </section>

        <form className="settings-section" onSubmit={handleProfileSubmit}>
          <div className="section-heading">
            <h3>Edit profile</h3>
          </div>
          <label>
            <span>Name</span>
            <input onChange={(event) => setName(event.target.value)} type="text" value={name} />
          </label>
          <label>
            <span>About</span>
            <input maxLength={140} onChange={(event) => setAbout(event.target.value)} type="text" value={about} />
          </label>
          <button className="primary-button" disabled={isSavingProfile} type="submit">
            {isSavingProfile ? "Saving..." : "Save profile"}
          </button>
        </form>

        <form className="settings-section" onSubmit={handlePasswordSubmit}>
          <div className="section-heading">
            <h3>Change password</h3>
          </div>
          <label>
            <span>Current password</span>
            <input
              onChange={(event) => setCurrentPassword(event.target.value)}
              type="password"
              value={currentPassword}
            />
          </label>
          <label>
            <span>New password</span>
            <input minLength={6} onChange={(event) => setNewPassword(event.target.value)} type="password" value={newPassword} />
          </label>
          <button className="primary-button" disabled={isChangingPassword} type="submit">
            {isChangingPassword ? "Updating..." : "Update password"}
          </button>
        </form>

        <section className="settings-section">
          <div className="section-heading">
            <h3>Blocked users</h3>
            <span>{blockedUsers.length}</span>
          </div>

          {blockedUsers.length ? (
            <div className="blocked-stack">
              {blockedUsers.map((blockedUser) => (
                <div className="blocked-card" key={blockedUser._id}>
                  <div className="user-chip">
                    <AvatarBadge size="sm" user={blockedUser} />
                    <div>
                      <strong>{blockedUser.name}</strong>
                      <span>{blockedUser.about || blockedUser.email}</span>
                    </div>
                  </div>
                  <button className="ghost-button" onClick={() => onUnblock(blockedUser._id)} type="button">
                    Unblock
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted-copy">No blocked users yet.</p>
          )}
        </section>
      </section>
    </div>
  );
}

export default SettingsModal;
