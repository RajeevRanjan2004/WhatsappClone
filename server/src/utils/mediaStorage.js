import { v2 as cloudinary } from "cloudinary";

const parseBoolean = (value = "") => /^true$/i.test(String(value).trim());
const trimEnvValue = (value = "") => String(value ?? "").trim().replace(/^["']+|["']+$/g, "");
const cloudNamePattern = /^[a-z0-9_-]+$/i;

let configured = false;
let warnedAboutInvalidConfig = false;

const parseCloudinaryUrl = (value = "") => {
  const rawValue = trimEnvValue(value);

  if (!rawValue.startsWith("cloudinary://")) {
    return null;
  }

  try {
    const parsedUrl = new URL(rawValue);

    return {
      apiKey: decodeURIComponent(parsedUrl.username || ""),
      apiSecret: decodeURIComponent(parsedUrl.password || ""),
      cloudName: trimEnvValue(parsedUrl.hostname || "")
    };
  } catch {
    return null;
  }
};

const normalizeCloudName = (value = "") => {
  const rawValue = trimEnvValue(value);

  if (!rawValue) {
    return "";
  }

  const parsedFromCloudinaryUrl = parseCloudinaryUrl(rawValue);

  if (parsedFromCloudinaryUrl?.cloudName) {
    return parsedFromCloudinaryUrl.cloudName;
  }

  const apiPathMatch = rawValue.match(/\/v1_1\/([^/]+)/i);

  if (apiPathMatch?.[1]) {
    return trimEnvValue(apiPathMatch[1]);
  }

  const deliveryPathMatch = rawValue.match(/res\.cloudinary\.com\/([^/]+)/i);

  if (deliveryPathMatch?.[1]) {
    return trimEnvValue(deliveryPathMatch[1]);
  }

  const hostMatch = rawValue.match(/^([a-z0-9_-]+)\.cloudinary\.com$/i);

  if (hostMatch?.[1]) {
    return trimEnvValue(hostMatch[1]);
  }

  return rawValue;
};

const getCloudinaryEnv = () => {
  const parsedUrl =
    parseCloudinaryUrl(process.env.CLOUDINARY_URL) || parseCloudinaryUrl(process.env.CLOUDINARY_CLOUD_NAME);

  const cloudName = normalizeCloudName(process.env.CLOUDINARY_CLOUD_NAME || parsedUrl?.cloudName || "");
  const apiKey = trimEnvValue(process.env.CLOUDINARY_API_KEY || parsedUrl?.apiKey || "");
  const apiSecret = trimEnvValue(process.env.CLOUDINARY_API_SECRET || parsedUrl?.apiSecret || "");

  return {
    apiKey,
    apiSecret,
    cloudName
  };
};

const hasAnyCloudinaryEnv = () =>
  Boolean(
    trimEnvValue(process.env.CLOUDINARY_CLOUD_NAME) ||
      trimEnvValue(process.env.CLOUDINARY_API_KEY) ||
      trimEnvValue(process.env.CLOUDINARY_API_SECRET) ||
      trimEnvValue(process.env.CLOUDINARY_URL)
  );

const isValidCloudinaryConfig = ({ apiKey, apiSecret, cloudName }) =>
  Boolean(apiKey && apiSecret && cloudName && cloudNamePattern.test(cloudName));

const ensureCloudinaryConfig = () => {
  if (configured || !isCloudinaryConfigured()) {
    if (!configured && !warnedAboutInvalidConfig && hasAnyCloudinaryEnv()) {
      console.warn("Cloudinary config is invalid. Falling back to local uploads.");
      warnedAboutInvalidConfig = true;
    }

    return;
  }

  const { apiKey, apiSecret, cloudName } = getCloudinaryEnv();

  cloudinary.config({
    api_key: apiKey,
    api_secret: apiSecret,
    cloud_name: cloudName,
    secure: !parseBoolean(process.env.CLOUDINARY_DISABLE_SECURE)
  });

  configured = true;
};

export const isCloudinaryConfigured = () =>
  isValidCloudinaryConfig(getCloudinaryEnv());

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
