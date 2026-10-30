#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const TEST_FILE = /^(backend\/tests\/[\w.-]+\.test\.ts|frontend\/src\/[\w./-]+\.test\.tsx?)$/
const RUNS = 3

function parseArgs(argv) {
  const options = {}
  for (let i = 0; i < argv.length; i += 2) options[argv[i].replace(/^--/, '')] = argv[i + 1]
  for (const name of ['patch', 'base', 'analysis', 'out']) {
    if (!options[name]) throw new Error(`Missing --${name}`)
  }
  return options
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  return { ok: result.status === 0, output: `${result.stdout ?? ''}${result.stderr ?? ''}` }
}

function lineCount(ranges) {
  return ranges.reduce((sum, range) => {
    const [from, to = from] = range.split('-').map(Number)
    return sum + to - from + 1
  }, 0)
}

function uncovered(analysis) {
  const result = {}
  for (const pkg of Object.values(analysis.packages ?? {})) {
    for (const source of pkg.sources) result[source.path] = lineCount(source.uncoveredChangedLines)
  }
  return result
}

function checkPatch(root, patch) {
  const errors = []
  const check = run('git', ['apply', '--check', patch], root)
  if (!check.ok) return { ok: false, files: [], errors: [`Patch does not apply: ${check.output.trim()}`] }
  const files = run('git', ['apply', '--numstat', patch], root).output.trim().split('\n').filter(Boolean).map((line) => {
    const [added, deleted, file] = line.split('\t')
    return { path: file, added: Number(added), deleted: Number(deleted) }
  })
  for (const file of files) {
    if (file.path.includes(' => ')) errors.push(`Rename is not allowed: ${file.path}`)
    else if (!TEST_FILE.test(file.path)) errors.push(`Not a unit test file: ${file.path}`)
    if (Number.isNaN(file.added)) errors.push(`Binary change is not allowed: ${file.path}`)
  }
  for (const line of run('git', ['apply', '--summary', patch], root).output.split('\n')) {
    const entry = line.trim()
    if (!entry) continue
    if (/^create mode 100644 /.test(entry)) continue
    errors.push(`Unsupported change: ${entry}`)
  }
  return { ok: errors.length === 0, files, errors }
}

function main() {
  const options = parseArgs(process.argv.slice(2))
  const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim()
  const before = JSON.parse(readFileSync(options.analysis, 'utf8'))
  const verify = { verdict: 'rejected', reason: '', patch: null, packages: {}, coverage: null }
  const finish = () => writeFileSync(options.out, `${JSON.stringify(verify, null, 2)}\n`)

  if (!existsSync(options.patch) || statSync(options.patch).size === 0) {
    verify.verdict = 'empty'
    verify.reason = 'The agent produced no test changes.'
    return finish()
  }

  verify.patch = checkPatch(root, options.patch)
  if (!verify.patch.ok) {
    verify.reason = 'The patch touches files other than unit tests.'
    return finish()
  }
  run('git', ['apply', options.patch], root)

  const touched = ['backend', 'frontend'].filter((pkg) => verify.patch.files.some((f) => f.path.startsWith(`${pkg}/`)))
  for (const pkg of touched) {
    const cwd = path.join(root, pkg)
    const typecheck = run('npx', ['tsc', '--noEmit'], cwd)
    const runs = []
    for (let i = 0; i < RUNS; i++) {
      const result = run('npx', ['vitest', 'run'], cwd)
      runs.push({ ok: result.ok, tail: result.ok ? '' : result.output.split('\n').slice(-30).join('\n') })
    }
    verify.packages[pkg] = {
      typecheck: { ok: typecheck.ok, tail: typecheck.ok ? '' : typecheck.output.split('\n').slice(-30).join('\n') },
      runs,
    }
  }

  run('git', ['add', '--', ...verify.patch.files.map((f) => f.path)], root)
  run('git', ['-c', 'user.name=verify', '-c', 'user.email=verify@localhost', 'commit', '--no-verify', '-qm', 'verify'], root)
  const after = run('node', ['.claude/skills/analyze-changes/scripts/changed-sources.mjs', '--base', options.base, '--head', 'HEAD'], root)
  const beforeLines = uncovered(before)
  const afterLines = after.ok ? uncovered(JSON.parse(after.output)) : {}
  verify.coverage = {
    before: Object.values(beforeLines).reduce((a, b) => a + b, 0),
    after: after.ok ? Object.values(afterLines).reduce((a, b) => a + b, 0) : null,
    files: Object.keys(beforeLines).map((file) => ({ path: file, before: beforeLines[file], after: afterLines[file] ?? null })),
  }

  const failures = Object.entries(verify.packages).flatMap(([pkg, result]) => [
    ...(result.typecheck.ok ? [] : [`${pkg}: typecheck failed`]),
    ...(result.runs.every((r) => r.ok) ? [] : [`${pkg}: ${result.runs.filter((r) => !r.ok).length}/${RUNS} test runs failed`]),
  ])
  if (failures.length) {
    verify.reason = failures.join('; ')
    return finish()
  }
  verify.verdict = 'accepted'
  verify.reason = `Only unit test files changed; typecheck passed; ${RUNS}/${RUNS} runs green.`
  finish()
}

main()
