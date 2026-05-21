import mongoose from "mongoose";

const storySchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    caption: {
      type: String,
      default: "",
      maxlength: 240
    },
    expiresAt: {
      type: Date,
      required: true
    },
    kind: {
      type: String,
      enum: ["text", "image", "video"],
      default: "text"
    },
    mediaMimeType: {
      type: String,
      default: ""
    },
    mediaUrl: {
      type: String,
      default: ""
    },
    mediaStorageKey: {
      type: String,
      default: ""
    },
    text: {
      type: String,
      default: "",
      maxlength: 500
    },
    viewers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      }
    ]
  },
  {
    timestamps: true
  }
);

const Story = mongoose.model("Story", storySchema);

export default Story;
