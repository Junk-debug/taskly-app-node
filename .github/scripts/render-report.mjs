#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

export const MARKER = '<!-- unit-test-agent-report -->'

function parseArgs(argv) {
  const options = {}
  for (let i = 0; i < argv.length; i += 2) options[argv[i].replace(/^--/, '')] = argv[i + 1]
  if (!options.out) throw new Error('Missing --out')
  return options
}

function readJson(file) {
  if (!file || !existsSync(file)) return null
  const text = readFileSync(file, 'utf8').trim()
  return text ? JSON.parse(text) : null
}

function readGuard(file) {
  if (!file || !existsSync(file)) return null
  const entries = readFileSync(file, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line))
  return {
    allowed: entries.filter((e) => e.decision === 'allow').length,
    denied: entries.filter((e) => e.decision === 'deny'),
  }
}

function cell(text) {
  return String(text ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ')
}

function analysisSection(analysis) {
  const rows = Object.values(analysis.packages ?? {}).flatMap((pkg) => pkg.sources)
  if (rows.length === 0) return []
  return [
    '| Changed source | Uncovered changed lines | Existing test |',
    '|---|---|---|',
    ...rows.map((s) => `| \`${s.path}\` | ${s.uncoveredChangedLines.join(', ') || 'none'} | ${s.testExists ? `\`${s.test}\`` : 'none'} |`),
    '',
  ]
}

function verifySection(verify) {
  const icon = { accepted: '✅', rejected: '❌', empty: '➖' }[verify.verdict] ?? '❔'
  const lines = [`**Verification:** ${icon} ${verify.verdict} — ${cell(verify.reason)}`]
  if (verify.coverage?.after !== null && verify.coverage) {
    lines.push(`**Uncovered changed lines:** ${verify.coverage.before} → ${verify.coverage.after}`)
  }
  for (const error of verify.patch?.errors ?? []) lines.push(`- ${cell(error)}`)
  for (const [pkg, result] of Object.entries(verify.packages ?? {})) {
    const green = result.runs.filter((r) => r.ok).length
    lines.push(`- \`${pkg}\`: typecheck ${result.typecheck.ok ? 'ok' : 'failed'}, ${green}/${result.runs.length} test runs green`)
  }
  return [...lines, '']
}

function readText(file) {
  return file && existsSync(file) ? readFileSync(file, 'utf8').trim() : ''
}

function main() {
  const options = parseArgs(process.argv.slice(2))
  const analysis = readJson(options.analysis)
  const verify = readJson(options.verify)
  const guard = readGuard(options.guard)
  const lines = [MARKER, '## 🧪 Unit test agent', '']

  if (options.status === 'no-credentials') {
    lines.push('Skipped: no `CLAUDE_CODE_OAUTH_TOKEN` or `ANTHROPIC_API_KEY` secret is configured.', '')
  } else if (analysis && !analysis.needsAgent) {
    lines.push(`**No tests needed.** ${analysis.reasons.join(' ')}`, '', ...analysisSection(analysis))
  } else {
    const agentReport = readText(options['agent-report'])
    const agentResult = readText(options['agent-result'])
    if (analysis) lines.push(...analysisSection(analysis))
    if (verify) lines.push(...verifySection(verify))
    if (guard) {
      lines.push(`**Guard hook:** ${guard.allowed} tool calls allowed, ${guard.denied.length} blocked`)
      for (const entry of guard.denied) lines.push(`- blocked \`${cell(entry.target).slice(0, 120)}\`: ${cell(entry.reason)}`)
      lines.push('')
    }
    if (options.commit) lines.push(`**Committed:** ${options.commit}`, '')
    if (options.status !== 'success') {
      lines.push(`**The agent did not finish** (status: ${options.status ?? 'unknown'}).`, '')
      if (agentResult) lines.push('```', agentResult, '```', '')
    }
    if (agentReport) {
      lines.push('<details open><summary><b>Agent report</b></summary>', '', agentReport.slice(0, 8000), '', '</details>', '')
    }
  }

  if (options['run-url']) lines.push(`<sub>[Workflow run](${options['run-url']})</sub>`)
  writeFileSync(options.out, `${lines.join('\n')}\n`)
}

main()
