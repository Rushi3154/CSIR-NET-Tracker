const fs = require("node:fs");
const path = require("node:path");
const esbuild = require("esbuild");

const projectRoot = path.resolve(__dirname, "..");
const webDirectory = path.join(projectRoot, "www");
fs.mkdirSync(webDirectory, { recursive: true });
fs.copyFileSync(
  path.join(projectRoot, "index.html"),
  path.join(webDirectory, "index.html")
);
esbuild.buildSync({
  entryPoints: [path.join(projectRoot, "android-file-bridge.js")],
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "es2020",
  outfile: path.join(webDirectory, "android-file-bridge.js")
});
