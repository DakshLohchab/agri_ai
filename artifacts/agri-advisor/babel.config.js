const fs = require("fs");
const path = require("path");

function loadExpoRouterPlugin() {
  const expoPackageJson = fs.realpathSync(require.resolve("expo/package.json"));
  const pluginPath = path.join(
    path.dirname(expoPackageJson),
    "..",
    "babel-preset-expo",
    "build",
    "expo-router-plugin.js",
  );
  return require(pluginPath).expoRouterBabelPlugin;
}

module.exports = function (api) {
  api.cache(true);
  return {
    presets: [["babel-preset-expo", { unstable_transformImportMeta: true }]],
    plugins: [loadExpoRouterPlugin()],
  };
};
