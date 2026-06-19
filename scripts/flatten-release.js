const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const releaseDir = path.join(projectRoot, "release");
const unpackedDir = path.join(releaseDir, "win-unpacked");

if (!fs.existsSync(unpackedDir)) {
  process.exit(0);
}

for (const entry of fs.readdirSync(unpackedDir)) {
  const source = path.join(unpackedDir, entry);
  const target = path.join(releaseDir, entry);

  fs.rmSync(target, { recursive: true, force: true });
  fs.renameSync(source, target);
}

fs.rmSync(unpackedDir, { recursive: true, force: true });
