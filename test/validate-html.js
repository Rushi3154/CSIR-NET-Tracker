const fs = require("fs");
const vm = require("vm");
const html = fs.readFileSync("index.html", "utf-8");

// Find script tags
const scriptRegex = /<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/gi;
let match;
let count = 0;
while ((match = scriptRegex.exec(html)) !== null) {
  count++;
  const code = match[1];
  const offset = html.substring(0, match.index).split("\n").length;
  try {
    new vm.Script(code, { filename: `index.html(line ${offset})` });
    console.log(`✓ Script block ${count} (around line ${offset}) is valid.`);
  } catch (err) {
    console.error(`❌ Syntax error in Script block ${count} around HTML line ${offset}:`);
    console.error(err);
  }
}
