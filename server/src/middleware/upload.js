import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import multer from "multer";
import { isCloudinaryConfigured, uploadBufferToCloudinary } from "../utils/mediaStorage.js";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(currentDir, "..");
const uploadsRoot = path.join(serverRoot, "uploads");

const ensureDirectory = (directoryPath) => {
  if (!fs.existsSync(directoryPath)) {
    fs.mkdirSync(directoryPath, { recursive: true });
  }
};

const sanitizeFilename = (filename) =>
  filename
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]/g, "-")
    .replace(/-+/g, "-");

const buildFilename = (file) => {
  const extension = path.extname(file.originalname || "") || "";
  const baseName = path.basename(file.originalname || "file", extension);
  const safeName = sanitizeFilename(baseName) || "file";

  return `${Date.now()}-${Math.round(Math.random() * 1e9)}-${safeName}${extension}`;
};

const createDiskStorage = (folderName) =>
  multer.diskStorage({
    destination(_req, _file, callback) {
      const targetDir = path.join(uploadsRoot, folderName);
      ensureDirectory(targetDir);
      callback(null, targetDir);
    },
    filename(_req, file, callback) {
      callback(null, buildFilename(file));
    }
  });

const createStorage = (folderName) => (isCloudinaryConfigured() ? multer.memoryStorage() : createDiskStorage(folderName));

const audioMimeTypePattern = /^audio\//i;
const imageMimeTypePattern = /^image\//i;
const videoMimeTypePattern = /^video\//i;

export const uploadAvatar = multer({
  limits: {
    fileSize: 5 * 1024 * 1024
  },
  fileFilter(_req, file, callback) {
    if (!imageMimeTypePattern.test(file.mimetype)) {
      callback(new Error("Avatar must be an image file."));
      return;
    }

    callback(null, true);
  },
  storage: createStorage("avatars")
});

export const uploadMessageAttachment = multer({
  limits: {
    fileSize: 40 * 1024 * 1024
  },
  fileFilter(_req, file, callback) {
    if (
      imageMimeTypePattern.test(file.mimetype) ||
      videoMimeTypePattern.test(file.mimetype) ||
      audioMimeTypePattern.test(file.mimetype)
    ) {
      callback(null, true);
      return;
    }

    const allowedFileTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "text/plain",
      "application/zip",
      "application/x-zip-compressed"
    ];

    if (!allowedFileTypes.includes(file.mimetype)) {
      callback(new Error("Unsupported file type."));
      return;
    }

    callback(null, true);
  },
  storage: createStorage("messages")
});

export const uploadStoryMedia = multer({
  limits: {
    fileSize: 25 * 1024 * 1024
  },
  fileFilter(_req, file, callback) {
    if (imageMimeTypePattern.test(file.mimetype) || videoMimeTypePattern.test(file.mimetype)) {
      callback(null, true);
      return;
    }

    callback(new Error("Story media must be an image or video."));
  },
  storage: createStorage("stories")
});

export const getPublicUploadPath = (folderName, filename) => `/uploads/${folderName}/${filename}`;
export const getUploadsRoot = () => uploadsRoot;

const persistBufferedFile = (file, folderName) => {
  const targetDir = path.join(uploadsRoot, folderName);
  ensureDirectory(targetDir);

  const filename = buildFilename(file);
  const filePath = path.join(targetDir, filename);
  fs.writeFileSync(filePath, file.buffer);

  return {
    storageKey: "",
    url: getPublicUploadPath(folderName, filename)
  };
};

export const storeUploadedFile = async (file, folderName) => {
  if (!file) {
    return null;
  }

  if (isCloudinaryConfigured()) {
    try {
      return await uploadBufferToCloudinary(file, folderName);
    } catch (error) {
      console.error(`Cloudinary upload failed for ${folderName}:`, error.message);

      if (file.buffer) {
        return persistBufferedFile(file, folderName);
      }

      throw error;
    }
  }

  if (file.buffer) {
    return persistBufferedFile(file, folderName);
  }

  return {
    storageKey: "",
    url: getPublicUploadPath(folderName, file.filename)
  };
};
