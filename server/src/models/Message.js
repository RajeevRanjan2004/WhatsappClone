import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    text: {
      type: String,
      trim: true,
      maxlength: 2000
    },
    kind: {
      type: String,
      enum: ["text", "image", "video", "file", "audio"],
      default: "text"
    },
    attachments: [
      {
        url: {
          type: String,
          required: true
        },
        storageKey: {
          type: String,
          default: ""
        },
        originalName: {
          type: String,
          required: true
        },
        mimeType: {
          type: String,
          required: true
        },
        size: {
          type: Number,
          required: true
        },
        kind: {
          type: String,
          enum: ["image", "video", "file", "audio"],
          required: true
        }
      }
    ],
    readBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      }
    ],
    isDeleted: {
      type: Boolean,
      default: false
    },
    deletedAt: {
      type: Date,
      default: null
    },
    deliveredTo: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      }
    ],
    deletedForEveryone: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

const Message = mongoose.model("Message", messageSchema);

export default Message;
