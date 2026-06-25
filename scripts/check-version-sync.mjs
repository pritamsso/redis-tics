import fs from "node:fs";

const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
const packageLock = JSON.parse(fs.readFileSync("package-lock.json", "utf8"));
const tauriConfig = JSON.parse(fs.readFileSync("src-tauri/tauri.conf.json", "utf8"));
const cargoToml = fs.readFileSync("src-tauri/Cargo.toml", "utf8");
const cargoVersion = cargoToml.match(/^version = "(.*)"$/m)?.[1];

const versions = {
  "package.json": packageJson.version,
  "package-lock.json": packageLock.version,
  "package-lock root": packageLock.packages?.[""]?.version,
  "src-tauri/Cargo.toml": cargoVersion,
  "src-tauri/tauri.conf.json": tauriConfig.version,
};

const uniqueVersions = new Set(Object.values(versions));
if (uniqueVersions.size !== 1) {
  console.error("Version mismatch:");
  for (const [file, version] of Object.entries(versions)) {
    console.error(`  ${file}: ${version}`);
  }
  process.exit(1);
}

console.log(`Version sync OK: ${packageJson.version}`);
