// src/autonomy/reality-anchor.ts
//
// Closes a real gap found while auditing the organ registry: entries
// named 'drift-monitor', 'hallucination-filter', 'hallucination-sentinel',
// and 'reality-anchor-organ' exist ONLY as strings in
// system-wiring.ts's declarative organ list -- confirmed via grep,
// zero logic attached. The introspection/audit endpoints report these
// as active organs. That's a real instance of the exact theater this
// project's own standing rule prohibits, just surfacing in the
// system's self-report instead of a pasted doc.
//
// This module is the first real implementation behind one of those
// names: automated checks on AI-generated code (from generate.ts)
// for the same red flags this session has been manually catching in
// pasted "upgrade" documents all session:
//   - Math.random() used where a real decision or score is claimed
//   - hardcoded literal secrets/keys instead of env vars
//   - fetch/axios calls to domains that don't resolve or are
//     obviously fake (.local, "fakehost", "example.com" used as if
//     production)
//   - relative imports pointing at files that don't exist in the
//     generated file set
//
// Honest scope: this is pattern-based static analysis, not a model
// judging semantic truth. It will not catch every hallucination, and
// it can false-positive on legitimate uses (e.g. Math.random() in a
// UI animation is fine). It reports findings for human review; it does
// not silently block generation.

export interface RealityAnchorFinding {
  file: string;
  line: number;
  severity: 'high' | 'medium';
  issue: string;
  snippet: string;
}

const FAKE_DOMAIN_PATTERNS = [/\.local\b/i, /fakehost/i, /example\.(com|org|net)\b/i, /placeholder/i, /yourapi/i];
const RANDOM_AS_LOGIC_CONTEXT = /\b(score|confidence|valid|pass|success|trust|approve|decision)\b/i;

export function checkGeneratedFiles(files: Record<string, string>): RealityAnchorFinding[] {
  const findings: RealityAnchorFinding[] = [];
  const fileNames = new Set(Object.keys(files));

  for (const [file, content] of Object.entries(files)) {
    const lines = content.split('\n');
    lines.forEach((line, idx) => {
      const lineNo = idx + 1;

      if (/Math\.random\(\)/.test(line) && RANDOM_AS_LOGIC_CONTEXT.test(line)) {
        findings.push({ file, line: lineNo, severity: 'high', issue: 'Math.random() appears alongside a decision/score/confidence term -- likely fabricated logic standing in for a real computation.', snippet: line.trim().slice(0, 160) });
      }

      for (const pattern of FAKE_DOMAIN_PATTERNS) {
        if (pattern.test(line) && /https?:\/\//.test(line)) {
          findings.push({ file, line: lineNo, severity: 'high', issue: `Line references a domain matching /${pattern.source}/, which is very likely a non-functional placeholder rather than a real endpoint.`, snippet: line.trim().slice(0, 160) });
        }
      }

      const literalSecretMatch = line.match(/(api[_-]?key|secret|token|password)\s*[:=]\s*["'][A-Za-z0-9_\-]{12,}["']/i);
      if (literalSecretMatch && !/process\.env/.test(line)) {
        findings.push({ file, line: lineNo, severity: 'high', issue: 'Literal-looking secret/key/token hardcoded instead of read from an environment variable.', snippet: line.trim().slice(0, 160) });
      }

      const relativeImport = line.match(/from\s+['"](\.[^'"]+)['"]/);
      if (relativeImport) {
        const target = relativeImport[1];
        const resolved = target.endsWith('.ts') || target.endsWith('.js') ? target.replace(/^\.\//, '') : `${target.replace(/^\.\//, '')}.ts`;
        if (!fileNames.has(resolved) && !fileNames.has(target.replace(/^\.\//, ''))) {
          findings.push({ file, line: lineNo, severity: 'medium', issue: `Relative import "${target}" does not match any file in this generated batch. May reference a file that doesn't exist.`, snippet: line.trim().slice(0, 160) });
        }
      }
    });
  }
  return findings;
}
