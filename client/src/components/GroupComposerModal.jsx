import { useEffect, useMemo, useState } from "react";

import AvatarBadge from "./AvatarBadge.jsx";

function GroupComposerModal({ contacts, initialSelectedIds = [], isOpen, onClose, onCreateGroup }) {
  const [selectedIds, setSelectedIds] = useState([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const sortedContacts = useMemo(
    () =>
      [...contacts]
        .filter((contact) => !contact.isBlocked && !contact.hasBlockedYou)
        .sort((left, right) => left.name.localeCompare(right.name)),
    [contacts]
  );

  useEffect(() => {
    if (isOpen) {
      setSelectedIds(initialSelectedIds);
    }
  }, [initialSelectedIds, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setName("");
      setDescription("");
      setSelectedIds([]);
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const toggleUser = (userId) => {
    setSelectedIds((current) =>
      current.includes(userId) ? current.filter((value) => value !== userId) : [...current, userId]
    );
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      await onCreateGroup({
        description,
        name,
        participantIds: selectedIds
      });
      setName("");
      setDescription("");
      setSelectedIds([]);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="settings-shell" role="dialog" aria-modal="true">
      <button aria-label="Close group creation" className="settings-backdrop" onClick={onClose} type="button" />
      <section className="settings-panel">
        <div className="settings-header">
          <div>
            <span className="eyebrow">Groups</span>
            <h2>Create a group</h2>
          </div>
          <button className="ghost-button" onClick={onClose} type="button">
            Close
          </button>
        </div>

        <form className="settings-section" onSubmit={handleSubmit}>
          <label>
            <span>Group name</span>
            <input onChange={(event) => setName(event.target.value)} required type="text" value={name} />
          </label>
          <label>
            <span>Description</span>
            <input onChange={(event) => setDescription(event.target.value)} type="text" value={description} />
          </label>
          <div className="group-pick-grid">
            {sortedContacts.map((contact) => (
              <button
                className={`group-pick-card ${selectedIds.includes(contact._id) ? "group-pick-active" : ""}`}
                key={contact._id}
                onClick={() => toggleUser(contact._id)}
                type="button"
              >
                <AvatarBadge size="sm" user={contact} />
                <div className="story-copy">
                  <strong>{contact.name}</strong>
                  <span>{contact.about || contact.email}</span>
                </div>
              </button>
            ))}
          </div>
          <button className="primary-button" disabled={isSubmitting || selectedIds.length < 2} type="submit">
            {isSubmitting ? "Creating..." : "Create group"}
          </button>
        </form>
      </section>
    </div>
  );
}

export default GroupComposerModal;
