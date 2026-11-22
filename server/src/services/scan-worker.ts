import { env } from "../config/env.js"
import { publishScan } from "./scan-dto.js"
import { runScan } from "./scan-runner.js"
import { ScanQueue } from "./scan-queue.js"

/** The process-wide worker. Started from server.ts; tests build their own ScanQueue with a fake runner. */
export const scanWorker = new ScanQueue({
  concurrency: env.SCAN_CONCURRENCY,
  run: (scan, signal) => runScan(scan, signal),
  onRecoveredFailure: ({ id, userId }) => void publishScan(userId, "scan:failed", id).catch(() => {}),
})
