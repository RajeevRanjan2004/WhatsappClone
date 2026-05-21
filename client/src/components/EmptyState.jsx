function EmptyState({ onOpenSidebar }) {
  return (
    <section className="empty-state">
      <span className="eyebrow">Realtime direct messages</span>
      <h2>Pick a conversation to start chatting.</h2>
      <p>
        Open the people list, start a chat, and test live messaging from another browser or Android device.
      </p>
      <button className="ghost-button mobile-only-inline" type="button" onClick={onOpenSidebar}>
        Open contacts
      </button>
    </section>
  );
}

export default EmptyState;

