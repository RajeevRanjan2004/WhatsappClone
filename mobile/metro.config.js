const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
const defaultResolveRequest = config.resolver.resolveRequest;
const webrtcPackageRoot = path.dirname(require.resolve("react-native-webrtc/package.json"));
const eventTargetShimRoot = path.join(webrtcPackageRoot, "node_modules", "event-target-shim");

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    moduleName.startsWith("event-target-shim") &&
    context.originModulePath.includes(`${path.sep}react-native-webrtc${path.sep}`)
  ) {
    const subpath = moduleName.replace("event-target-shim", "").replace(/^[\\/]/, "");
    const rawTargetPath = subpath ? path.join(eventTargetShimRoot, subpath) : path.join(eventTargetShimRoot, "index.js");
    const filePath = path.extname(rawTargetPath) ? rawTargetPath : `${rawTargetPath}.js`;

    return {
      filePath,
      type: "sourceFile"
    };
  }

  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
