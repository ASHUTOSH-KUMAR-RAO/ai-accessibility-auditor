#!/bin/sh
# Apply migrations, then REPLACE this shell with node (exec) so SIGTERM/SIGINT reach the app
# and its graceful shutdown (running scans are handed back to the queue) actually runs.
set -e
node node_modules/prisma/build/index.js migrate deploy
exec node dist/server.js
