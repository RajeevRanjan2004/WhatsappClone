import fs from "node:fs/promises";
import path from "node:path";

import { getUploadsRoot } from "../middleware/upload.js";
import { removeCloudinaryAsset } from "./mediaStorage.js";

const uploadsRoot = getUploadsRoot();

const toUploadFilePath = (publicPath = "") => {
  const normalized = publicPath.replace(/^https?:\/\/[^/]+/i, "").replace(/^\/+/, "");

  if (!normalized.startsWith("uploads/")) {
    return null;
  }

  return path.join(uploadsRoot, normalized.replace(/^uploads[\\/]/, ""));
};

export const removeUploadFile = async (publicPath, storageKey = "") => {
  if (storageKey) {
    await removeCloudinaryAsset(storageKey);
    return;
  }

  const filePath = toUploadFilePath(publicPath);

  if (!filePath) {
    return;
  }

  try {
    await fs.unlink(filePath);
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error(`Failed to remove upload: ${publicPath}`, error.message);
    }
  }
};

export const removeMessageAttachments = async (attachments = []) => {
  await Promise.all(attachments.map((attachment) => removeUploadFile(attachment.url, attachment.storageKey)));
};
