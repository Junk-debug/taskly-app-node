#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

const PACKAGES = {
  backend: {
    source: /^backend\/src\/.+\.ts$/,
    testFor: (file) => `backend/tests/${path.basename(file, '.ts')}.test.ts`,
  },
  frontend: {
    source: /^frontend\/src\/.+\.tsx?$/,
    testFor: (file) => file.replace(/\.(tsx?)$/, '.test.$1'),
  },
}

const EXCLUDED = [
  /\.test\.tsx?$/,
  /\.stories\.tsx$/,
  /\.styles\.ts$/,
  /\.d\.ts$/,
  /(^|\/)types\.ts$/,
  /\.types\.ts$/,
  /(^|\/)index\.ts$/,
  /\/generated\//,
  /^backend\/src\/main\.ts$/,
  /^frontend\/src\/main\.tsx$/,
  /^frontend\/src\/design-system\//,
  /^frontend\/src\/test\//,
]

function parseArgs(argv) {
  const options = { base: 'origin/main', head: 'HEAD', coverage: true, files: null }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--base') options.base = argv[++i]
    else if (argv[i] === '--head') options.head = argv[++i]
    else if (argv[i] === '--no-coverage') options.coverage = false
    else if (argv[i] === '--files') options.files = argv.slice(i + 1)
    else throw new Error(`Unknown argument: ${argv[i]}`)
    if (options.files) break
  }
  return options
}

function git(root, args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' })
}

function relative(root, file) {
  return path.relative(root, path.resolve(root, file)).split(path.sep).join('/')
}

function packageOf(file) {
  return Object.keys(PACKAGES).find((name) => PACKAGES[name].source.test(file))
}

function isSource(file) {
  return Boolean(packageOf(file)) && !EXCLUDED.some((pattern) => pattern.test(file))
}

function changedFiles(root, range) {
  return git(root, ['diff', '--name-status', '-M', '--diff-filter=AMRD', range])
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [code, ...paths] = line.split('\t')
      const status = { A: 'added', M: 'modified', D: 'deleted', R: 'renamed' }[code[0]]
      return { status, path: paths.at(-1) }
    })
}

function allLines(root, file) {
  const count = readFileSync(path.join(root, file), 'utf8').split('\n').length
  return Array.from({ length: count }, (_, i) => i + 1)
}

function changedLines(root, range, file) {
  const lines = []
  for (const line of git(root, ['diff', '-U0', range, '--', file]).split('\n')) {
    const hunk = /^@@ -\S+ \+(\d+)(?:,(\d+))? @@/.exec(line)
    if (!hunk) continue
    const start = Number(hunk[1])
    const count = hunk[2] === undefined ? 1 : Number(hunk[2])
    for (let n = start; n < start + count; n++) lines.push(n)
  }
  return lines
}

function toRanges(lines) {
  const ranges = []
  for (const line of [...new Set(lines)].sort((a, b) => a - b)) {
    const last = ranges.at(-1)
    if (last && line === last[1] + 1) last[1] = line
    else ranges.push([line, line])
  }
  return ranges.map(([from, to]) => (from === to ? `${from}` : `${from}-${to}`))
}

function coveredLines(fileCoverage) {
  const innermost = new Map()
  for (const [id, location] of Object.entries(fileCoverage.statementMap)) {
    const span = location.end.line - location.start.line
    for (let line = location.start.line; line <= location.end.line; line++) {
      const current = innermost.get(line)
      if (!current || span < current.span || (span === current.span && fileCoverage.s[id] > 0)) {
        innermost.set(line, { span, hit: fileCoverage.s[id] > 0 })
      }
    }
  }
  return new Map([...innermost].map(([line, { hit }]) => [line, hit]))
}

function runRelated(root, pkg, files) {
  const dir = mkdtempSync(path.join(tmpdir(), `changed-sources-${pkg}-`))
  const cwd = path.join(root, pkg)
  try {
    spawnSync(
      'npx',
      [
        'vitest', 'related', '--run', '--passWithNoTests',
        '--reporter=json', `--outputFile=${path.join(dir, 'results.json')}`,
        '--coverage.enabled', '--coverage.reporter=json',
        `--coverage.reportsDirectory=${path.join(dir, 'coverage')}`,
        ...files.map((file) => path.relative(pkg, file)),
      ],
      { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    )
    const resultsFile = path.join(dir, 'results.json')
    const coverageFile = path.join(dir, 'coverage', 'coverage-final.json')
    const results = existsSync(resultsFile) ? JSON.parse(readFileSync(resultsFile, 'utf8')) : null
    const coverage = existsSync(coverageFile) ? JSON.parse(readFileSync(coverageFile, 'utf8')) : {}
    return {
      ran: Boolean(results),
      tests: (results?.testResults ?? []).map((result) => ({
        file: path.relative(root, result.name),
        status: result.status,
      })),
      coverage: Object.fromEntries(
        Object.entries(coverage).map(([file, data]) => [path.relative(root, file), data]),
      ),
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

function main() {
  const options = parseArgs(process.argv.slice(2))
  const root = git(process.cwd(), ['rev-parse', '--show-toplevel']).trim()
  const range = `${options.base}...${options.head}`
  const explicit = Boolean(options.files)
  const files = explicit
    ? options.files.map((file) => ({ status: 'explicit', path: relative(root, file) })).filter((file) => isSource(file.path))
    : changedFiles(root, range).filter((file) => isSource(file.path))
  const report = explicit
    ? { files: options.files, packages: {}, deleted: [], needsAgent: false, reasons: [] }
    : { base: options.base, head: options.head, packages: {}, deleted: [], needsAgent: false, reasons: [] }

  for (const file of files.filter((f) => f.status === 'deleted')) {
    const test = PACKAGES[packageOf(file.path)].testFor(file.path)
    report.deleted.push({ source: file.path, test, testExists: existsSync(path.join(root, test)) })
  }

  for (const pkg of Object.keys(PACKAGES)) {
    const sources = files.filter((f) => f.status !== 'deleted' && packageOf(f.path) === pkg)
    if (sources.length === 0) continue
    const related = options.coverage
      ? runRelated(root, pkg, sources.map((s) => s.path))
      : { ran: false, tests: [], coverage: {} }
    report.packages[pkg] = {
      relatedTests: related.tests,
      sources: sources.map((source) => {
        const test = PACKAGES[pkg].testFor(source.path)
        const lines = explicit ? allLines(root, source.path) : changedLines(root, range, source.path)
        const fileCoverage = related.coverage[source.path]
        const covered = fileCoverage ? coveredLines(fileCoverage) : null
        const uncovered = covered ? lines.filter((line) => covered.get(line) === false) : lines
        return {
          path: source.path,
          status: source.status,
          test,
          testExists: existsSync(path.join(root, test)),
          changedLines: toRanges(lines),
          coverage: covered ? 'measured' : 'not-collected',
          uncoveredChangedLines: toRanges(uncovered),
        }
      }),
    }
    const failed = related.tests.filter((t) => t.status !== 'passed')
    if (failed.length) report.reasons.push(`${pkg}: related tests fail: ${failed.map((t) => t.file).join(', ')}`)
    for (const source of report.packages[pkg].sources) {
      if (source.uncoveredChangedLines.length) {
        report.reasons.push(`${source.path}: uncovered changed lines ${source.uncoveredChangedLines.join(', ')}`)
      } else if (source.status === 'added' && !source.testExists) {
        report.reasons.push(`${source.path}: new file without its own test (coverage only comes from other modules' tests)`)
      }
    }
  }

  report.needsAgent = report.reasons.length > 0
  if (!report.needsAgent) {
    report.reasons.push(
      Object.keys(report.packages).length
        ? 'All changed lines are covered and related tests pass.'
        : 'No testable source files changed.',
    )
  }
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
}

main()
