import fs from "node:fs"
import path from "node:path"

import { createCoverageMap } from "istanbul-lib-coverage"
import reports from "istanbul-reports"
import { createContext } from "istanbul-lib-report"

const root = process.cwd()
const coverageDir = path.join(root, "coverage")
const outputDir = path.join(coverageDir, "merged")
const sources = [
  path.join(coverageDir, "jest", "coverage-final.json"),
  path.join(coverageDir, "vitest", "coverage-final.json"),
]

const map = createCoverageMap({})

for (const source of sources) {
  if (!fs.existsSync(source)) {
    throw new Error(`Coverage file not found: ${source}`)
  }

  map.merge(JSON.parse(fs.readFileSync(source, "utf8")))
}

fs.mkdirSync(outputDir, { recursive: true })
fs.writeFileSync(
  path.join(outputDir, "coverage-final.json"),
  JSON.stringify(map.toJSON(), null, 2)
)

const context = createContext({
  coverageMap: map,
  dir: outputDir,
})

for (const reporterName of ["text-summary", "json-summary", "lcov"]) {
  reports.create(reporterName).execute(context)
}

const summary = JSON.parse(
  fs.readFileSync(path.join(outputDir, "coverage-summary.json"), "utf8")
)
const totals = summary.total
const metrics = ["lines", "statements", "functions", "branches"]
const failed = metrics.filter((metric) => totals[metric].pct !== 100)

if (failed.length > 0) {
  throw new Error(
    `Coverage is below 100% for: ${failed.map((metric) => `${metric}=${totals[metric].pct}%`).join(", ")}`
  )
}
