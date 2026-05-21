import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 50
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
      select: false
    },
    avatarColor: {
      type: String,
      default: "#19c37d"
    },
    avatarUrl: {
      type: String,
      default: ""
    },
    avatarStorageKey: {
      type: String,
      default: ""
    },
    about: {
      type: String,
      default: "Available"
    },
    lastSeenAt: {
      type: Date,
      default: Date.now
    },
    blockedUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      }
    ],
    resetPasswordToken: {
      type: String,
      default: ""
    },
    resetPasswordExpiresAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

const User = mongoose.model("User", userSchema);

export default User;
