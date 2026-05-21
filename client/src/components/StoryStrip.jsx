import AvatarBadge from "./AvatarBadge.jsx";
import { formatStoryTime } from "../utils/chat.js";

function StoryStrip({ currentUser, onCreateGroup, onCreateStory, onOpenStory, storyGroups }) {
  return (
    <section className="story-strip">
      <div className="section-heading">
        <h2>Status and Groups</h2>
        <span>{storyGroups.length}</span>
      </div>

      <div className="story-row">
        <button className="story-card story-card-action" onClick={onCreateStory} type="button">
          <AvatarBadge size="sm" user={currentUser} />
          <div className="story-copy">
            <strong>My status</strong>
            <span>Add photo, video, or text</span>
          </div>
        </button>

        <button className="story-card story-card-action" onClick={onCreateGroup} type="button">
          <div className="group-plus">+</div>
          <div className="story-copy">
            <strong>New group</strong>
            <span>Create group chat</span>
          </div>
        </button>

        {storyGroups.map((storyGroup) => (
          <button className="story-card" key={storyGroup.author._id} onClick={() => onOpenStory(storyGroup)} type="button">
            <AvatarBadge size="sm" user={storyGroup.author} />
            <div className="story-copy">
              <strong>{storyGroup.author.name}</strong>
              <span>{formatStoryTime(storyGroup.stories[0]?.createdAt)}</span>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

export default StoryStrip;
