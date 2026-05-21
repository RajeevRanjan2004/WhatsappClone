import { resolveAssetUrl } from "../utils/assets.js";

function AvatarBadge({ user, size = "md" }) {
  const label = (user?.name || "?")
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <div
      className={`avatar-badge avatar-${size}`}
      style={{ backgroundColor: user?.avatarColor || "#00a884" }}
      aria-hidden="true"
    >
      {user?.avatarUrl ? (
        <img alt={user.name || "Profile"} className="avatar-image" src={resolveAssetUrl(user.avatarUrl)} />
      ) : (
        label
      )}
    </div>
  );
}

export default AvatarBadge;
