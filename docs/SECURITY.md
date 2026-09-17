# 🛡️ Security Policy

## Supported Versions

Fluxlane is currently in early development. Security fixes target the latest source version on the main branch.

| Version         | Supported |
| --------------- | --------- |
| `main`          | ✅        |
| Older snapshots | ❌        |

## Reporting a Vulnerability

Please do not create a public GitHub issue for security vulnerabilities.

Instead, contact the maintainer privately:

- GitHub: [RensithUdara](https://github.com/RensithUdara)

Include:

- A clear description of the issue.
- Steps to reproduce.
- Potential impact.
- Suggested fix, if you have one.

## Scope

Security-sensitive areas include:

- Download URL handling.
- File path and destination handling.
- Resume metadata.
- IPC boundaries between renderer and main process.
- Any behavior that could overwrite, expose, or corrupt local files.

## Responsible Disclosure

Please give the maintainer reasonable time to investigate and patch before public disclosure.
