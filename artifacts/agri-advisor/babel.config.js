const path = require("path");

function resolveExpoRouterPlugin() {
  const expoPackageJson = require.resolve("expo/package.json");
  return path.join(
    path.dirname(expoPackageJson),
    "..",
    "babel-preset-expo",
    "build",
    "expo-router-plugin.js",
  );
}

module.exports = function (api) {
  api.cache(true);
  return {
    presets: [["babel-preset-expo", { unstable_transformImportMeta: true }]],
    plugins: [resolveExpoRouterPlugin()],
  };
};
