/**
 * Severity is this tool's own opinion about how much a given strict-mode error
 * matters. The message text is NOT maintained here: it is read from the
 * audited project's own TypeScript installation, so it is always accurate for
 * the compiler version that actually produced the error.
 */
import { createRequire } from 'module';
import * as path from 'path';

const TS_ERROR_SEVERITY: Record<string, 'low' | 'medium' | 'high'> = {
  TS1005: 'high',
  TS1009: 'high',
  TS1011: 'high',
  TS2300: 'high',
  TS2304: 'high',
  TS2322: 'high',
  TS2329: 'high',
  TS2345: 'high',
  TS2352: 'high',
  TS2362: 'high',
  TS2366: 'high',
  TS2531: 'high',
  TS2532: 'high',
  TS2533: 'high',
  TS2538: 'high',
  TS2551: 'high',
  TS2554: 'high',
  TS2559: 'high',
  TS2564: 'high',
  TS2589: 'high',
  TS2590: 'high',
  TS2604: 'high',
  TS2677: 'high',
  TS2722: 'high',
  TS2739: 'high',
  TS2769: 'high',
  TS2783: 'high',
  TS5074: 'high',
  TS7005: 'high',
  TS7051: 'high',
  TS18046: 'high',
  TS18047: 'high',
  TS18048: 'high',
  TS18049: 'high',
  TS1109: 'medium',
  TS1146: 'medium',
  TS1174: 'medium',
  TS2307: 'medium',
  TS2309: 'medium',
  TS2339: 'medium',
  TS2349: 'medium',
  TS2420: 'medium',
  TS2451: 'medium',
  TS2454: 'medium',
  TS2488: 'medium',
  TS2503: 'medium',
  TS2511: 'medium',
  TS2512: 'medium',
  TS2515: 'medium',
  TS7006: 'medium',
  TS7015: 'medium',
  TS7017: 'medium',
  TS7022: 'medium',
  TS7023: 'medium',
  TS7024: 'medium',
  TS7030: 'medium',
  TS7031: 'medium',
  TS7034: 'medium',
  TS7043: 'medium',
  TS7053: 'medium',
  TS2790: 'low',
  TS2869: 'low',
  TS6133: 'low',
  TS6192: 'low',
  TS6196: 'low',
  TS7027: 'low',
  TS7019: 'low',
  TS80001: 'low',
  TS80002: 'low',
  TS80005: 'low',
  TS80008: 'low',
  TS80009: 'low'
};

type DiagnosticCatalogue = Map<number, string>;

let catalogue: DiagnosticCatalogue | null | undefined;

/**
 * Loads `ts.Diagnostics` from the TypeScript installed in the current working
 * directory (the project being audited). Resolved once and cached; `null` when
 * no TypeScript can be found, in which case messages are reported as unknown.
 */
function loadDiagnosticCatalogue(): DiagnosticCatalogue | null {
  if (catalogue !== undefined) {
    return catalogue;
  }

  try {
    const projectRequire = createRequire(path.join(process.cwd(), 'package.json'));
    const loaded: unknown = projectRequire('typescript');
    catalogue = readDiagnostics(loaded);
  } catch {
    catalogue = null;
  }

  return catalogue;
}

function readDiagnostics(loaded: unknown): DiagnosticCatalogue | null {
  if (typeof loaded !== 'object' || loaded === null || !('Diagnostics' in loaded)) {
    return null;
  }

  const diagnostics = loaded.Diagnostics;
  if (typeof diagnostics !== 'object' || diagnostics === null) {
    return null;
  }

  const result: DiagnosticCatalogue = new Map();
  for (const entry of Object.values(diagnostics)) {
    if (
      typeof entry === 'object' &&
      entry !== null &&
      'code' in entry &&
      'message' in entry &&
      typeof entry.code === 'number' &&
      typeof entry.message === 'string'
    ) {
      result.set(entry.code, entry.message);
    }
  }

  return result;
}

/** Exposed for tests; resets the cached catalogue. */
export function resetDiagnosticCatalogue(): void {
  catalogue = undefined;
}

export function getErrorMessage(code: string): string {
  const numeric = parseInt(code.replace(/^TS/, ''), 10);
  const message = Number.isNaN(numeric) ? undefined : loadDiagnosticCatalogue()?.get(numeric);
  return message ?? 'Unknown error code.';
}

export function getSeverity(code: string): string {
  const severity = TS_ERROR_SEVERITY[code] ?? 'unknown';
  const message = getErrorMessage(code);

  switch (severity) {
    case 'high':
      return `🔴 High: ${message}`;
    case 'medium':
      return `🟠 Medium: ${message}`;
    case 'low':
      return `🟢 Low: ${message}`;
    case 'unknown':
      return `🟡 Unknown: ${message}`;
  }
}
