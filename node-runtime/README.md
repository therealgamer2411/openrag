# OpenRAG Node Runtime — integration slice 0.1

This package introduces a shared, durable task protocol for OpenRAG nodes. It is isolated from the legacy dashboard/server until its API and state model are validated.

## Included
- Coordinator API with separate admin and worker credentials.
- Durable JSON state using atomic file replacement.
- Node registration, heartbeat, task claiming, leases, completion and retry after lease expiry.
- Idempotency keys for task submission.
- Allowlisted deterministic handlers: echo, sha256, sum.
- Built-in Node test suite.

## Run
1. Copy .env.example to .env and generate two different long random secrets.
2. Run npm install from this directory.
3. Run npm test.
4. Start the coordinator with npm start.
5. Start a worker in another terminal with npm run worker.

Submit a task to POST /v1/tasks with an Authorization: Bearer ADMIN_TOKEN header and JSON such as:
{"type":"sum","input":[1,2,3],"idempotencyKey":"demo-sum-001"}

Read status using GET /v1/tasks/TASK_ID and the admin bearer token.

## Important boundaries
- The JSON store is a single-coordinator MVP. Do not run multiple coordinators against the same data directory.
- Worker authentication currently uses a shared node token. Per-node enrollment, credential revocation and mTLS remain future security work.
- Task execution is allowlisted; no arbitrary JavaScript, shell commands or uploaded WASM modules are accepted.
- Lease expiry provides at-least-once delivery. Handlers must be idempotent; exactly-once execution is not promised.
- Browser, Windows Service and Capacitor adapters are not yet connected to this common worker protocol.
- ORP rewards are not issued yet; reward issuance must follow independent result verification.

## Design lineage
The lifecycle borrows architectural patterns from BOINC and iExec; provider/worker separation is informed by Golem. No upstream source code is copied in this initial integration slice. P2P transport remains a separate adapter until coordinator correctness is validated.
