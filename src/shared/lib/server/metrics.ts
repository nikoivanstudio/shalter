import os from "node:os"

function toMegabytes(bytes: number) {
  return Math.round((bytes / 1024 / 1024) * 10) / 10
}

function toPercent(part: number, total: number) {
  if (!total) {
    return 0
  }

  return Math.round((part / total) * 1000) / 10
}

export function getServerMetricsSnapshot() {
  const totalMemory = os.totalmem()
  const freeMemory = os.freemem()
  const usedMemory = totalMemory - freeMemory
  const processMemory = process.memoryUsage()
  const cpus = os.cpus()

  return {
    snapshotAt: new Date().toISOString(),
    host: os.hostname(),
    platform: `${os.platform()} ${os.arch()}`,
    nodeVersion: process.version,
    uptimeSeconds: Math.round(process.uptime()),
    systemUptimeSeconds: Math.round(os.uptime()),
    cpu: {
      cores: cpus.length,
      model: cpus[0]?.model ?? "Unknown CPU",
      loadAverage: os.loadavg(),
    },
    memory: {
      totalMb: toMegabytes(totalMemory),
      freeMb: toMegabytes(freeMemory),
      usedMb: toMegabytes(usedMemory),
      usedPercent: toPercent(usedMemory, totalMemory),
    },
    processMemory: {
      rssMb: toMegabytes(processMemory.rss),
      heapTotalMb: toMegabytes(processMemory.heapTotal),
      heapUsedMb: toMegabytes(processMemory.heapUsed),
      externalMb: toMegabytes(processMemory.external),
    },
  }
}

export type ServerMetricsSnapshot = ReturnType<typeof getServerMetricsSnapshot>
