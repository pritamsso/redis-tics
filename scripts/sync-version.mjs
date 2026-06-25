import fs from "node:fs";

const requestedVersion = process.argv[2];
const packageJsonPath = "package.json";
const packageLockPath = "package-lock.json";
const cargoTomlPath = "src-tauri/Cargo.toml";
const tauriConfigPath = "src-tauri/tauri.conf.json";

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, "utf8"));
}

function writeJson(path, value) {
  fs.writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function bumpPatch(version) {
  const parts = version.split(".").map((part) => Number.parseInt(part, 10));
  if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) {
    throw new Error(`Cannot patch-bump non-semver version: ${version}`);
  }
  parts[2] += 1;
  return parts.join(".");
}

function assertSemver(version) {
  if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error(`Version must be valid semver, got: ${version}`);
  }
}

const packageJson = readJson(packageJsonPath);
const version = requestedVersion && requestedVersion !== "--patch"
  ? requestedVersion
  : bumpPatch(packageJson.version);

assertSemver(version);

packageJson.version = version;
writeJson(packageJsonPath, packageJson);

if (fs.existsSync(packageLockPath)) {
  const packageLock = readJson(packageLockPath);
  packageLock.version = version;
  if (packageLock.packages?.[""]) {
    packageLock.packages[""].version = version;
  }
  writeJson(packageLockPath, packageLock);
}

let cargoToml = fs.readFileSync(cargoTomlPath, "utf8");
cargoToml = cargoToml.replace(/^version = ".*"$/m, `version = "${version}"`);
fs.writeFileSync(cargoTomlPath, cargoToml);

const tauriConfig = readJson(tauriConfigPath);
tauriConfig.version = version;
writeJson(tauriConfigPath, tauriConfig);

console.log(version);
