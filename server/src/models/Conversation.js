import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema(
  {
    kind: {
      type: String,
      enum: ["direct", "group"],
      default: "direct"
    },
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
      }
    ],
    groupAdmin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    groupAvatarUrl: {
      type: String,
      default: ""
    },
    groupDescription: {
      type: String,
      default: ""
    },
    groupName: {
      type: String,
      default: ""
    },
    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null
    },
    lastMessagePreview: {
      type: String,
      default: ""
    },
    lastMessageAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

const Conversation = mongoose.model("Conversation", conversationSchema);

export default Conversation;
