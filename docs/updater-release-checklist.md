# Updater Release Checklist

This is a public open-source repository. Do not commit updater private keys.

Before publishing auto-update builds, make sure the repository has this GitHub Actions secret:

- `TAURI_SIGNING_PRIVATE_KEY`

If the private key was generated with a password, also add:

- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`

Only the public key matching that private key should be committed in `src-tauri/tauri.conf.json` under `plugins.updater.pubkey`.

Release flow:

1. Run `npm run version:check`.
2. Publish from `main` with the `Build and Release` workflow.
3. For a manual version, use the workflow dispatch `version` input.
4. If the current version tag already exists, the workflow patch-bumps automatically.
5. The workflow builds signed updater artifacts and validates `latest.json`.
6. The app checks `https://github.com/pritamsso/redis-tics/releases/latest/download/latest.json`.

The workflow intentionally fails if the private signing key is missing, or if any updater artifact or signature is missing. A release without signatures would download but fail installation with updater signature errors.
