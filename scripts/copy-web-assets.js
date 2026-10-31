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
if (fs.existsSync(path.join(projectRoot, "data-protection.js"))) {
  fs.copyFileSync(
    path.join(projectRoot, "data-protection.js"),
    path.join(webDirectory, "data-protection.js")
  );
}
if (fs.existsSync(path.join(projectRoot, "undo-system.js"))) {
  fs.copyFileSync(
    path.join(projectRoot, "undo-system.js"),
    path.join(webDirectory, "undo-system.js")
  );
}
if (fs.existsSync(path.join(projectRoot, "study-sessions.js"))) {
  fs.copyFileSync(
    path.join(projectRoot, "study-sessions.js"),
    path.join(webDirectory, "study-sessions.js")
  );
}
if (fs.existsSync(path.join(projectRoot, "study-planner.js"))) {
  fs.copyFileSync(
    path.join(projectRoot, "study-planner.js"),
    path.join(webDirectory, "study-planner.js")
  );
}
["analytics.js", "exam-readiness.js", "focus-tools.js"].forEach(file => {
  const src = path.join(projectRoot, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(webDirectory, file));
  }
});
const srcDir = path.join(projectRoot, "src");
if (fs.existsSync(srcDir)) {
  fs.cpSync(srcDir, path.join(webDirectory, "src"), { recursive: true });
}
esbuild.buildSync({
  entryPoints: [path.join(projectRoot, "android-file-bridge.js")],
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "es2020",
  outfile: path.join(webDirectory, "android-file-bridge.js")
});
