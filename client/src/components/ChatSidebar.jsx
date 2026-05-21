import { GroupIcon, SearchIcon } from "./AppIcons.jsx";
import AvatarBadge from "./AvatarBadge.jsx";
import {
  formatSidebarTime,
  getConversationAvatar,
  getConversationTitle,
  getOtherParticipant
} from "../utils/chat.js";

function ChatSidebar({
  activeConversationId,
  contacts,
  conversationPreferences,
  conversations,
  currentUser,
  onCreateGroup,
  onSelectConversation,
  onStartConversation,
  searchQuery,
  setSearchQuery,
  unreadMap
}) {
  const query = searchQuery.trim().toLowerCase();
  const getPreferences = (conversationId) => ({
    chatLock: false,
    favourite: false,
    notificationsMuted: false,
    ...(conversationPreferences[conversationId] || {})
  });

  const filteredConversations = conversations
    .filter((conversation) => {
      const otherUser = getOtherParticipant(conversation, currentUser._id);
      const title = getConversationTitle(conversation, currentUser._id);

      if (!query) {
        return true;
      }

      const haystack = [
        title,
        otherUser?.name,
        otherUser?.email,
        conversation.groupDescription,
        conversation.lastMessagePreview
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    })
    .sort((left, right) => Number(getPreferences(right._id).favourite) - Number(getPreferences(left._id).favourite));

  const filteredContacts = contacts.filter((contact) => {
    if (!query) {
      return true;
    }

    return [contact.name, contact.email, contact.about].join(" ").toLowerCase().includes(query);
  });

  return (
    <section className="mobile-panel">
      <label className="mobile-search-shell">
        <SearchIcon className="mobile-search-icon" size={20} />
        <input
          className="mobile-search-input"
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Ask Meta AI or Search"
          type="search"
          value={searchQuery}
        />
      </label>

      <div className="mobile-inline-heading">
        <h2>Chats</h2>
        <button className="mini-action-button" onClick={onCreateGroup} type="button">
          <GroupIcon size={18} />
          <span>New group</span>
        </button>
      </div>

      {filteredConversations.length ? (
        <div className="chat-feed">
          {filteredConversations.map((conversation) => {
            const otherUser = getOtherParticipant(conversation, currentUser._id);
            const avatar = getConversationAvatar(conversation, currentUser._id);
            const isActive = activeConversationId === conversation._id;
            const preferences = getPreferences(conversation._id);
            const title = getConversationTitle(conversation, currentUser._id);
            const unreadCount = unreadMap[conversation._id] || 0;
            const preview = preferences.chatLock
              ? "Locked chat"
              : conversation.lastMessagePreview || "Start chatting";

            return (
              <button
                className={`chat-feed-card ${isActive ? "chat-feed-card-active" : ""}`}
                key={conversation._id}
                onClick={() => onSelectConversation(conversation._id)}
                type="button"
              >
                <div className="conversation-avatar-wrap">
                  <AvatarBadge size="md" user={avatar} />
                  {otherUser?.isOnline ? <span className="status-dot" /> : null}
                </div>

                <div className="chat-feed-copy">
                  <div className="chat-feed-topline">
                    <strong>{title}</strong>
                    <span>{formatSidebarTime(conversation.lastMessageAt)}</span>
                  </div>
                  <p>{preview}</p>
                </div>

                {unreadCount ? <span className="chat-feed-unread">{unreadCount}</span> : null}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="whats-empty-state">
          <strong>No chats yet</strong>
          <span>Create a group or start chatting with a contact below.</span>
        </div>
      )}

      {filteredContacts.length ? (
        <section className="mobile-subsection">
          <div className="mobile-inline-heading">
            <h3>People</h3>
          </div>

          <div className="contact-feed">
            {filteredContacts.map((contact) => (
              <button
                className={`contact-feed-card ${contact.isBlocked || contact.hasBlockedYou ? "contact-card-muted" : ""}`}
                key={contact._id}
                onClick={() => onStartConversation(contact._id)}
                type="button"
              >
                <div className="conversation-avatar-wrap">
                  <AvatarBadge size="sm" user={contact} />
                  {contact.isOnline ? <span className="status-dot" /> : null}
                </div>
                <div className="contact-feed-copy">
                  <strong>{contact.name}</strong>
                  <span>{contact.about || contact.email}</span>
                </div>
              </button>
            ))}
          </div>
        </section>
      ) : null}
    </section>
  );
}

export default ChatSidebar;
