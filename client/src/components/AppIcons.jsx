function IconBase({ children, className = "", size = 22, strokeWidth = 1.9, viewBox = "0 0 24 24" }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      height={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={strokeWidth}
      viewBox={viewBox}
      width={size}
    >
      {children}
    </svg>
  );
}

export function SearchIcon(props) {
  return (
    <IconBase {...props}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4 4" />
    </IconBase>
  );
}

export function CameraIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M4 7.5h3l1.6-2h6.8L17 7.5h3A1.5 1.5 0 0 1 21.5 9v9A1.5 1.5 0 0 1 20 19.5H4A1.5 1.5 0 0 1 2.5 18V9A1.5 1.5 0 0 1 4 7.5Z" />
      <circle cx="12" cy="13" r="3.6" />
    </IconBase>
  );
}

export function MoreIcon(props) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="5" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="12" cy="19" r="1.4" fill="currentColor" stroke="none" />
    </IconBase>
  );
}

export function ChatsIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M5 18.5 3.5 21l.4-3.1A7.8 7.8 0 0 1 4 7.7 8.4 8.4 0 0 1 12 4.5c4.7 0 8.5 3.3 8.5 7.4S16.7 19.3 12 19.3c-1.1 0-2.2-.2-3.2-.5Z" />
    </IconBase>
  );
}

export function StatusIcon(props) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="8.2" />
      <path d="M12 7.5v4.8l2.8 1.9" />
    </IconBase>
  );
}

export function CallsIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M7 4.5h2.4l1.1 4.2-1.9 1.6a15.6 15.6 0 0 0 5.1 5.1l1.6-1.9 4.2 1.1V17a2 2 0 0 1-2.1 2A15.9 15.9 0 0 1 5 6.6 2 2 0 0 1 7 4.5Z" />
    </IconBase>
  );
}

export function SettingsIcon(props) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="2.8" />
      <path d="M19.4 13.2V10.8l-2-0.6a5.8 5.8 0 0 0-.6-1.4l1-1.9-1.7-1.7-1.9 1a5.8 5.8 0 0 0-1.4-.6l-.6-2H10.8l-.6 2a5.8 5.8 0 0 0-1.4.6l-1.9-1L5.2 6.9l1 1.9a5.8 5.8 0 0 0-.6 1.4l-2 .6v2.4l2 .6a5.8 5.8 0 0 0 .6 1.4l-1 1.9 1.7 1.7 1.9-1a5.8 5.8 0 0 0 1.4.6l.6 2h2.4l.6-2a5.8 5.8 0 0 0 1.4-.6l1.9 1 1.7-1.7-1-1.9c.3-.4.5-.9.6-1.4l2-.6Z" />
    </IconBase>
  );
}

export function AudioCallIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M7 4.5h2.4l1.1 4.2-1.9 1.6a15.6 15.6 0 0 0 5.1 5.1l1.6-1.9 4.2 1.1V17a2 2 0 0 1-2.1 2A15.9 15.9 0 0 1 5 6.6 2 2 0 0 1 7 4.5Z" />
      <path d="M15.4 6.2a5 5 0 0 1 2.4 4.2" />
      <path d="M15.5 3.5a8.2 8.2 0 0 1 4 6.9" />
    </IconBase>
  );
}

export function VideoCallIcon(props) {
  return (
    <IconBase {...props}>
      <rect height="9" rx="2" width="11" x="3.5" y="7.5" />
      <path d="M14.5 10.2 20.5 7v10l-6-3.2" />
    </IconBase>
  );
}

export function BackIcon(props) {
  return (
    <IconBase {...props}>
      <path d="m14.5 5.5-7 6.5 7 6.5" />
    </IconBase>
  );
}

export function AccountIcon(props) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5.5 19c1.6-3 3.9-4.5 6.5-4.5S16.9 16 18.5 19" />
    </IconBase>
  );
}

export function PrivacyIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M12 3.5 19 6v5.8c0 4.2-2.8 7.4-7 8.7-4.2-1.3-7-4.5-7-8.7V6l7-2.5Z" />
      <path d="M9.8 11.8 11.3 13.3 14.8 9.8" />
    </IconBase>
  );
}

export function LanguageIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M4.5 7.5h11" />
      <path d="M10 4.5c0 5.2-2.3 9.2-5.5 11.5" />
      <path d="M8 12c1.2 1.9 3 3.7 5.6 5.3" />
      <path d="M15.5 9.5h4l2 8" />
      <path d="M16.5 14.5h4" />
    </IconBase>
  );
}

export function HelpIcon(props) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9.7 9.2a2.6 2.6 0 1 1 4.7 1.5c-.7.8-1.9 1.5-1.9 3" />
      <path d="M12 17h0" />
    </IconBase>
  );
}

export function StorageIcon(props) {
  return (
    <IconBase {...props}>
      <ellipse cx="12" cy="6" rx="7.5" ry="2.8" />
      <path d="M4.5 6v5.2C4.5 12.8 7.9 14 12 14s7.5-1.2 7.5-2.8V6" />
      <path d="M4.5 11v5.2C4.5 17.8 7.9 19 12 19s7.5-1.2 7.5-2.8V11" />
    </IconBase>
  );
}

export function GroupIcon(props) {
  return (
    <IconBase {...props}>
      <circle cx="9" cy="9" r="2.5" />
      <circle cx="16.5" cy="10" r="2" />
      <path d="M4.5 18c.9-2.5 2.8-4 4.9-4 2.2 0 4.1 1.5 5 4" />
      <path d="M14.8 14.5c1.4.2 2.7 1.2 3.7 3" />
    </IconBase>
  );
}

export function LogoutIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M9.5 4.5H6.8A2.3 2.3 0 0 0 4.5 6.8v10.4a2.3 2.3 0 0 0 2.3 2.3h2.7" />
      <path d="M13 8.5 18 12l-5 3.5" />
      <path d="M10 12h8" />
    </IconBase>
  );
}

export function PlusIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </IconBase>
  );
}

export function EmojiIcon(props) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8.5 10.5h0" />
      <path d="M15.5 10.5h0" />
      <path d="M8.5 14c1 1.2 2.2 1.8 3.5 1.8s2.5-.6 3.5-1.8" />
    </IconBase>
  );
}

export function ClipIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M9.5 7.5 15 13a3 3 0 0 1-4.2 4.2L5 11.4a5 5 0 1 1 7.1-7.1l5.2 5.2" />
    </IconBase>
  );
}

export function PayIcon(props) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M14.8 8.2h-4.1l3.2 3.1h-3.2" />
      <path d="M9.8 15.8h4.3l-3.3-3.1h3.3" />
    </IconBase>
  );
}

export function NotificationIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M12 20a2.6 2.6 0 0 0 2.4-1.5H9.6A2.6 2.6 0 0 0 12 20Z" />
      <path d="M6.5 17.5h11l-1.4-2.2V11a4.1 4.1 0 1 0-8.2 0v4.3Z" />
    </IconBase>
  );
}

export function MediaIcon(props) {
  return (
    <IconBase {...props}>
      <rect height="13" rx="2" width="17" x="3.5" y="5.5" />
      <path d="m7.5 14 2.6-2.7 2.1 2.1 2.7-3.1 3.6 3.7" />
      <circle cx="9" cy="9.3" r="1.1" />
    </IconBase>
  );
}

export function LockIcon(props) {
  return (
    <IconBase {...props}>
      <rect height="9.5" rx="2" width="11" x="6.5" y="10" />
      <path d="M9 10V7.8a3 3 0 1 1 6 0V10" />
    </IconBase>
  );
}

export function ShieldIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M12 3.5 19 6v5.8c0 4.2-2.8 7.4-7 8.7-4.2-1.3-7-4.5-7-8.7V6l7-2.5Z" />
    </IconBase>
  );
}

export function FavouriteIcon(props) {
  return (
    <IconBase {...props}>
      <path d="m12 19-1.4-1.2C6.2 14 4 11.9 4 9.2A3.7 3.7 0 0 1 7.8 5.5c1.4 0 2.7.7 3.5 1.8a4.3 4.3 0 0 1 3.5-1.8A3.7 3.7 0 0 1 18.6 9c0 2.8-2.1 5-6.6 8.8Z" />
    </IconBase>
  );
}

export function ListIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M9 7h10" />
      <path d="M9 12h10" />
      <path d="M9 17h10" />
      <circle cx="5.2" cy="7" r="1" fill="currentColor" stroke="none" />
      <circle cx="5.2" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="5.2" cy="17" r="1" fill="currentColor" stroke="none" />
    </IconBase>
  );
}

export function ReportIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M12 4.5v7" />
      <path d="M12 15.5h0" />
      <path d="M6 19.5h12l-1.6-2.7L13.7 6.4a2 2 0 0 0-3.4 0L7.6 16.8Z" />
    </IconBase>
  );
}

export function ChevronRightIcon(props) {
  return (
    <IconBase {...props}>
      <path d="m10 6 5 6-5 6" />
    </IconBase>
  );
}

export function SendIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M20 4 9 15" />
      <path d="m20 4-7 16-2.5-5.5L5 12l15-8Z" />
    </IconBase>
  );
}

export function MicIcon(props) {
  return (
    <IconBase {...props}>
      <rect height="8.5" rx="3" width="6" x="9" y="4.5" />
      <path d="M7.5 11.5a4.5 4.5 0 0 0 9 0" />
      <path d="M12 16v3.5" />
    </IconBase>
  );
}

export function MicOffIcon(props) {
  return (
    <IconBase {...props}>
      <rect height="8.5" rx="3" width="6" x="9" y="4.5" />
      <path d="M7.5 11.5a4.5 4.5 0 0 0 9 0" />
      <path d="M12 16v3.5" />
      <path d="m5 5 14 14" />
    </IconBase>
  );
}

export function CameraOffIcon(props) {
  return (
    <IconBase {...props}>
      <rect height="9" rx="2" width="11" x="3.5" y="7.5" />
      <path d="M14.5 10.2 20.5 7v10l-6-3.2" />
      <path d="m4.5 4.5 15 15" />
    </IconBase>
  );
}

export function SpeakerIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M5 10h3.2L12 6.8v10.4L8.2 14H5Z" />
      <path d="M15.2 9.2a4.5 4.5 0 0 1 0 5.6" />
      <path d="M17.5 7a7.5 7.5 0 0 1 0 10" />
    </IconBase>
  );
}

export function SpeakerOffIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M5 10h3.2L12 6.8v10.4L8.2 14H5Z" />
      <path d="m5 5 14 14" />
    </IconBase>
  );
}

export function AnswerCallIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M6.5 14.5c2.3 2.7 8.7 2.7 11 0" />
      <path d="M7.5 13a16 16 0 0 1 9 0" />
      <path d="M9 11.2 7 14.8" />
      <path d="m15 11.2 2 3.6" />
    </IconBase>
  );
}

export function EndCallIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M6.5 14.5c2.3-2.7 8.7-2.7 11 0" />
      <path d="M7.5 16a16 16 0 0 1 9 0" />
      <path d="M9 17.8 7 14.2" />
      <path d="m15 17.8 2-3.6" />
    </IconBase>
  );
}

export function MoonIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M15.5 3.8a7.8 7.8 0 1 0 4.7 13.7 8.3 8.3 0 0 1-4.6 1.3A8.3 8.3 0 0 1 7.3 10.5c0-2.6 1.2-5 3.2-6.6a7.5 7.5 0 0 0 5 .1Z" />
    </IconBase>
  );
}

export function SunIcon(props) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="3.8" />
      <path d="M12 2.8v2.1" />
      <path d="M12 19.1v2.1" />
      <path d="m5.5 5.5 1.5 1.5" />
      <path d="m17 17 1.5 1.5" />
      <path d="M2.8 12h2.1" />
      <path d="M19.1 12h2.1" />
      <path d="m5.5 18.5 1.5-1.5" />
      <path d="M17 7l1.5-1.5" />
    </IconBase>
  );
}

export function CopyIcon(props) {
  return (
    <IconBase {...props}>
      <rect height="11" rx="2" width="9" x="8.5" y="7.5" />
      <path d="M6.5 15.5H6A2.5 2.5 0 0 1 3.5 13V6A2.5 2.5 0 0 1 6 3.5h7A2.5 2.5 0 0 1 15.5 6v.5" />
    </IconBase>
  );
}

export function ShareIcon(props) {
  return (
    <IconBase {...props}>
      <circle cx="17.5" cy="6.5" r="2" />
      <circle cx="6.5" cy="12" r="2" />
      <circle cx="17.5" cy="17.5" r="2" />
      <path d="m8.2 11 7.2-3.5" />
      <path d="m8.2 13 7.2 3.5" />
    </IconBase>
  );
}
