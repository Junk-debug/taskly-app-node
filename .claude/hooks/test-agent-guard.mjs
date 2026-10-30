#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const TEST_FILE = /^(backend\/tests\/[\w.-]+\.test\.ts|frontend\/src\/[\w./-]+\.test\.tsx?)$/
const SAFE_TOKEN = /^[\w@./:=,+*?-]+$/
const QUOTED = /^'([^']*)'$|^"([^"$`\\]*)"$/
const FIND_ACTIONS = /^-(exec|execdir|ok|okdir|delete|fprint|fprint0|fprintf|fls)$/
const PACKAGES = ['backend', 'frontend']

const input = JSON.parse(readFileSync(0, 'utf8'))
const root = path.resolve(process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd())
const cwd = path.resolve(input.cwd || root)

function deny(reason) {
  process.stderr.write(`Blocked by test-agent guard: ${reason}\n`)
  process.exit(2)
}

function relative(file, base = cwd) {
  return path.relative(root, path.resolve(base, file)).split(path.sep).join('/')
}

function isTestFile(file, base) {
  return TEST_FILE.test(relative(file, base))
}

function isTracked(file, base) {
  try {
    execFileSync('git', ['ls-files', '--error-unmatch', relative(file, base)], { cwd: root, stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

function unquote(token) {
  const quoted = QUOTED.exec(token)
  return quoted ? (quoted[1] ?? quoted[2]) : token
}

function tokens(command) {
  const parts = command.trim().split(/\s+/)
  if (!parts.every((part) => QUOTED.test(part) || SAFE_TOKEN.test(part))) deny(`unsupported characters in: ${command}`)
  return parts.map(unquote)
}

function checkBash(command) {
  let base = cwd
  let rest = command.trim()
  const cd = /^cd\s+(\S+)\s+&&\s+(.+)$/s.exec(rest)
  if (cd) {
    const target = path.resolve(cwd, unquote(cd[1]))
    if (!PACKAGES.some((pkg) => target === path.join(root, pkg))) deny(`cd only into backend/ or frontend/: ${command}`)
    base = target
    rest = cd[2]
  }
  const inPackage = PACKAGES.some((pkg) => base === path.join(root, pkg))
  const [program, sub, ...args] = tokens(rest)

  if (program === 'npx') {
    if (!inPackage) deny('npx must run inside backend/ or frontend/ (prefix with cd <package> &&)')
    if (sub === 'vitest' && ['run', 'related'].includes(args[0])) return
    if (sub === 'tsc' && args.length === 1 && args[0] === '--noEmit') return
    if (sub === 'prettier' && args[0] === '--write' && args.length > 1 && args.slice(1).every((f) => isTestFile(f, base))) return
    deny(`npx command not allowed: ${rest}`)
  }
  if (program === 'node' && relative(sub ?? '', base) === '.claude/skills/analyze-changes/scripts/changed-sources.mjs') return
  if (program === 'git') {
    if (['diff', 'log', 'status', 'show'].includes(sub) && !args.some((a) => a.startsWith('--output') || a === '--ext-diff')) return
    if (sub === 'restore' && args.length === 1 && isTestFile(args[0], base)) return
    if (sub === 'checkout' && args[0] === '--' && args.length === 2 && isTestFile(args[1], base)) return
    deny(`git command not allowed: ${rest}`)
  }
  if (program === 'ls' || program === 'grep') return
  if (program === 'find' && ![sub, ...args].some((a) => FIND_ACTIONS.test(a))) return
  if (program === 'rm' && args.length === 0 && sub && isTestFile(sub, base) && !isTracked(sub, base)) return
  deny(`command not allowed: ${rest}`)
}

const tool = input.tool_name
const toolInput = input.tool_input ?? {}

if (['Write', 'Edit', 'MultiEdit'].includes(tool)) {
  if (!isTestFile(toolInput.file_path ?? '')) deny(`only unit test files may be written, not ${toolInput.file_path}`)
} else if (tool === 'NotebookEdit') {
  deny('notebooks may not be edited')
} else if (tool === 'Bash') {
  checkBash(toolInput.command ?? '')
}
process.exit(0)
