# OpenRAG Desktop Runtime (Windows)

This is the desktop-side path for work that must outlive the browser process.

## Library

- `node-windows` installs and manages a Node.js process as a Windows Service.

## Install

1. Install a supported Node.js LTS release.
2. Run `npm install` in this folder.
3. Set environment variables for the service account:
   - `OPENRAG_WITNESS_URL=https://openrag-persistence-lab.vercel.app/api/witness`
   - `OPENRAG_NODE_ID=<stable-device-id>`
4. Run an elevated terminal and execute `node install.js`.
5. Confirm the service in Windows Services. Remove it through the node-windows uninstall flow when no longer needed.

## Current scope

The service currently emits a heartbeat every 30 seconds to the configured witness endpoint. It proves the independent process can be hosted outside the browser; it does not yet run OpenRAG compute jobs, maintain the browser's WebRTC session, or provide task authentication/verification.

## Security and operation

- Installation is explicit and requires administrator approval.
- The service must be visible to the device owner and have a clear uninstall path.
- Do not run untrusted jobs in this process.
- Do not embed secrets in source code. Use service-scoped environment variables.
- A later iteration must add authenticated task leasing, bounded execution, checkpoints, result verification, and graceful shutdown.
