const SECRET_PATTERN = /(?:\b(?:api[_ -]?key|secret|token|password|private[_ -]?key|authorization)\b[\"']?\s*(?:[:=]|is)\s*['\"]?)(?:[a-z0-9_\-.]{8,})/i;
const HIGH_RISK_INPUT = /(?:\b(?:rm\s+-rf|curl\s+.*\|\s*(?:sh|bash)|wget\s+.*\|\s*(?:sh|bash)|child_process|process\.env|eval\(|new Function|disable\s+paragon|bypass\s+(?:paragon|omnirouter)|override\s+(?:constitution|doctrine)))/i;

export type SecurityFinding = { organ: string; severity: 'low' | 'medium' | 'high'; message: string };

export class SecurityOrgans {
  static inspectInput(value: unknown): SecurityFinding[] {
    const rendered = typeof value === 'string' ? value : JSON.stringify(value);
    const findings: SecurityFinding[] = [];
    if (SECRET_PATTERN.test(rendered)) findings.push({ organ: 'Boundary Organ', severity: 'high', message: 'Potential secret material was supplied in an operational input. Secrets must be injected only through the runtime environment and referenced by name.' });
    if (HIGH_RISK_INPUT.test(rendered)) findings.push({ organ: 'Threat Detection Organ', severity: 'high', message: 'Input contains a prohibited bypass, unrestricted execution, or destructive-command pattern.' });
    if (rendered.length > 100_000) findings.push({ organ: 'Resource Organ', severity: 'medium', message: 'Input exceeds the bounded 100 KB procedure limit.' });
    return findings;
  }

  static assertSafeInput(value: unknown): void {
    const findings = this.inspectInput(value);
    const blocking = findings.find((finding) => finding.severity === 'high');
    if (blocking) throw new Error(`Security Organs blocked the input: ${blocking.message}`);
  }

  static redact(value: string): string {
    return value
      .replace(/(Bearer\s+)[^\s,;]+/gi, '$1[REDACTED]')
      .replace(/((?:api[_-]?key|secret|token|password|private[_-]?key)\s*(?:[:=])\s*)[^\s,;]+/gi, '$1[REDACTED]')
      .slice(0, 10_000);
  }
}
