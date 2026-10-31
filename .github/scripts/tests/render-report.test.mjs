import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'

const script = path.resolve(import.meta.dirname, '../render-report.mjs')
let dir

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'render-'))
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

function render(files, args = []) {
  const flags = []
  for (const [name, content] of Object.entries(files)) {
    const file = path.join(dir, name)
    writeFileSync(file, typeof content === 'string' ? content : JSON.stringify(content))
    flags.push(`--${name.replace(/\.\w+$/, '')}`, file)
  }
  const out = path.join(dir, 'comment.md')
  const result = spawnSync('node', [script, ...flags, ...args, '--out', out], { encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr)
  return readFileSync(out, 'utf8')
}

const source = { path: 'frontend/src/a.ts', test: 'frontend/src/a.test.ts', testExists: true, uncoveredChangedLines: ['7'] }

test('starts with the marker used to update the comment in place', () => {
  const body = render({ analysis: { needsAgent: false, reasons: ['No testable source files changed.'], packages: {} } })
  assert.ok(body.startsWith('<!-- unit-test-agent-report -->\n'))
  assert.match(body, /\*\*No tests needed\.\*\* No testable source files changed\./)
})

test('explains a skipped run without credentials', () => {
  const body = render({ analysis: { needsAgent: true, reasons: ['x'], packages: {} } }, ['--status', 'no-credentials'])
  assert.match(body, /no `CLAUDE_CODE_OAUTH_TOKEN` or `ANTHROPIC_API_KEY` secret/)
})

test('keeps measured results apart from the agent report and neutralizes mentions', () => {
  const body = render(
    {
      analysis: { needsAgent: true, reasons: ['x'], packages: { frontend: { sources: [source] } } },
      verify: {
        verdict: 'accepted', reason: 'ok', patch: { errors: [] },
        packages: { frontend: { typecheck: { ok: true }, runs: [{ ok: true }, { ok: true }, { ok: true }] } },
        coverage: { before: 1, after: 0 },
        againstBase: [{ file: 'frontend/src/a.test.ts', detectsChange: true, failed: 1, total: 2 }],
      },
      'agent-report.md': 'Ping @maintainer <!-- unit-test-agent-report -->',
    },
    ['--status', 'success'],
  )
  const measured = body.indexOf('### Measured by the workflow')
  const reported = body.indexOf('### Reported by the agent (not verified)')
  assert.ok(measured > 0 && reported > measured)
  assert.match(body, /\*\*Uncovered changed lines:\*\* 1 → 0/)
  assert.match(body, /\| `frontend\/src\/a\.test\.ts` \| 1\/2 failing \| 🛡️ guards the change \|/)
  assert.ok(!body.includes('@maintainer'))
  assert.equal(body.split('<!-- unit-test-agent-report -->').length, 2)
})

test('shows why the agent stopped', () => {
  const body = render(
    { analysis: { needsAgent: true, reasons: ['x'], packages: {} }, 'agent-result.txt': 'Failed to authenticate.' },
    ['--status', 'failure'],
  )
  assert.match(body, /\*\*The agent did not finish\*\* \(status: failure\)/)
  assert.match(body, /Failed to authenticate\./)
})
