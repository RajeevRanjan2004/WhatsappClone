import { v2 as cloudinary } from "cloudinary";

const parseBoolean = (value = "") => /^true$/i.test(String(value).trim());

let configured = false;

const ensureCloudinaryConfig = () => {
  if (configured || !isCloudinaryConfigured()) {
    return;
  }

  cloudinary.config({
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    secure: !parseBoolean(process.env.CLOUDINARY_DISABLE_SECURE)
  });

  configured = true;
};

export const isCloudinaryConfigured = () =>
  Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);

export const uploadBufferToCloudinary = async (file, folderName) => {
  ensureCloudinaryConfig();

  if (!isCloudinaryConfigured()) {
    throw new Error("Cloudinary is not configured.");
  }

  const folder = [process.env.CLOUDINARY_FOLDER || "pulsechat", folderName].filter(Boolean).join("/");

  const result = await new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "auto",
        use_filename: true,
        unique_filename: true
      },
      (error, uploadedAsset) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(uploadedAsset);
      }
    );

    uploadStream.end(file.buffer);
  });

  return {
    storageKey: `${result.resource_type}:${result.public_id}`,
    url: result.secure_url
  };
};

export const removeCloudinaryAsset = async (storageKey = "") => {
  ensureCloudinaryConfig();

  if (!isCloudinaryConfigured() || !storageKey) {
    return;
  }

  const [resourceType = "image", ...publicIdParts] = String(storageKey).split(":");
  const publicId = publicIdParts.join(":");

  if (!publicId) {
    return;
  }

  try {
    await cloudinary.uploader.destroy(publicId, {
      invalidate: true,
      resource_type: resourceType
    });
  } catch (error) {
    console.error(`Failed to remove cloud asset: ${storageKey}`, error.message);
  }
};
