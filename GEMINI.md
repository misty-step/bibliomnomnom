# Gemini Agent Operational Guidelines

## Interactive Server Commands

- **DO NOT** run local server commands (e.g., `bun run dev`, `npm run dev`, `yarn start`, `go run .`) yourself.
- **ALWAYS** ask the user to run these commands in their own terminal.
- Reason: You are running in a non-interactive environment where long-running processes cannot be properly managed or interacted with by the user.
