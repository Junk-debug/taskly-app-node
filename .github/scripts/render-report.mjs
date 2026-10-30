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

function decisionsSection(report) {
  return [
    '| Source | Decision | Test file | Reason |',
    '|---|---|---|---|',
    ...report.decisions.map((d) => `| \`${d.source}\` | **${d.decision}** | ${d.testFile ? `\`${d.testFile}\`` : ''} | ${cell(d.reason)} |`),
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

function listSection(title, items, format) {
  if (!items?.length) return [`**${title}:** none`, '']
  return [`**${title}:**`, ...items.map((item) => `- ${format(item)}`), '']
}

function main() {
  const options = parseArgs(process.argv.slice(2))
  const analysis = readJson(options.analysis)
  const report = readJson(options.report)
  const verify = readJson(options.verify)
  const guard = readGuard(options.guard)
  const lines = [MARKER, '## 🧪 Unit test agent', '']

  if (options.status === 'no-credentials') {
    lines.push('Skipped: no `CLAUDE_CODE_OAUTH_TOKEN` or `ANTHROPIC_API_KEY` secret is configured.', '')
  } else if (analysis && !analysis.needsAgent) {
    lines.push(`**No tests needed.** ${analysis.reasons.join(' ')}`, '', ...analysisSection(analysis))
  } else {
    if (analysis) lines.push(...analysisSection(analysis))
    if (report) {
      lines.push(cell(report.summary), '', ...decisionsSection(report))
      lines.push(...listSection('Tests written', report.tests, (t) => `\`${t.file}\` (${t.result}, ${t.runs} runs): ${t.cases.map(cell).join('; ')}`))
      lines.push(...listSection('Suspected bugs', report.suspectedBugs, (b) => `\`${b.source}\`${b.line ? `:${b.line}` : ''} — ${cell(b.description)} (expected ${cell(b.expected)}, actual ${cell(b.actual)})`))
      lines.push(...listSection('Dropped cases', report.dropped, (d) => `\`${d.file}\` — ${cell(d.case)}: ${cell(d.lastError)}`))
    } else {
      lines.push(`**The agent did not finish** (status: ${options.status ?? 'unknown'}). See the workflow run for details.`, '')
      const result = options['agent-result'] && existsSync(options['agent-result']) ? readFileSync(options['agent-result'], 'utf8').trim() : ''
      if (result) lines.push('```', result.slice(0, 1500), '```', '')
    }
    if (verify) lines.push(...verifySection(verify))
    if (guard) {
      lines.push(`**Guard hook:** ${guard.allowed} tool calls allowed, ${guard.denied.length} blocked`)
      for (const entry of guard.denied) lines.push(`- blocked \`${cell(entry.target).slice(0, 120)}\`: ${cell(entry.reason)}`)
      lines.push('')
    }
    if (options.commit) lines.push(`**Committed:** ${options.commit}`, '')
  }

  if (options['run-url']) lines.push(`<sub>[Workflow run](${options['run-url']})</sub>`)
  writeFileSync(options.out, `${lines.join('\n')}\n`)
}

main()
