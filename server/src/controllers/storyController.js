import Story from "../models/Story.js";
import { storeUploadedFile } from "../middleware/upload.js";
import { serializeStory } from "../utils/serializers.js";

const userFields = "name email avatarColor avatarUrl about blockedUsers lastSeenAt";

const getStoryOptions = (req) => ({
  onlineUsers: req.app.get("onlineUsers"),
  viewer: req.user
});

export const listStories = async (req, res, next) => {
  try {
    const now = new Date();
    const stories = await Story.find({
      expiresAt: { $gt: now }
    })
      .sort({ createdAt: -1 })
      .populate("author", userFields);

    const visibleStories = stories.filter((story) => {
      const authorId = story.author?._id?.toString();

      if (!authorId) {
        return false;
      }

      if (authorId === req.user._id.toString()) {
        return true;
      }

      const viewerBlockedAuthor = (req.user.blockedUsers || []).some((blockedUserId) => blockedUserId.toString() === authorId);
      const authorBlockedViewer = (story.author.blockedUsers || []).some(
        (blockedUserId) => blockedUserId.toString() === req.user._id.toString()
      );

      return !viewerBlockedAuthor && !authorBlockedViewer;
    });

    const groupedStories = visibleStories.reduce((collection, story) => {
      const authorId = story.author._id.toString();

      if (!collection[authorId]) {
        collection[authorId] = {
          author: story.author,
          stories: []
        };
      }

      collection[authorId].stories.push(story);
      return collection;
    }, {});

    res.json(
      Object.values(groupedStories).map((entry) => ({
        author: serializeStory(entry.stories[0], getStoryOptions(req)).author,
        stories: entry.stories.map((story) => serializeStory(story, getStoryOptions(req)))
      }))
    );
  } catch (error) {
    next(error);
  }
};

export const createStory = async (req, res, next) => {
  try {
    const caption = req.body?.caption?.trim() || "";
    const text = req.body?.text?.trim() || "";
    const file = req.file || null;

    if (!file && !text) {
      res.status(400);
      throw new Error("Story text or media is required.");
    }

    const kind = file ? (file.mimetype.startsWith("video/") ? "video" : "image") : "text";
    const uploadedMedia = file ? await storeUploadedFile(file, "stories") : null;
    const story = await Story.create({
      author: req.user._id,
      caption,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      kind,
      mediaMimeType: file?.mimetype || "",
      mediaStorageKey: uploadedMedia?.storageKey || "",
      mediaUrl: uploadedMedia?.url || "",
      text
    });

    const populatedStory = await Story.findById(story._id).populate("author", userFields);
    const serializedStory = serializeStory(populatedStory, getStoryOptions(req));
    req.app.get("io")?.emit("story:new", { story: serializedStory });

    res.status(201).json({
      story: serializedStory
    });
  } catch (error) {
    next(error);
  }
};

export const markStoryViewed = async (req, res, next) => {
  try {
    const story = await Story.findById(req.params.storyId).populate("author", userFields);

    if (!story || story.expiresAt <= new Date()) {
      res.status(404);
      throw new Error("Story not found.");
    }

    story.viewers = Array.from(new Set([...story.viewers.map(String), req.user._id.toString()]));
    await story.save();

    res.json({
      story: serializeStory(story, getStoryOptions(req))
    });
  } catch (error) {
    next(error);
  }
};
