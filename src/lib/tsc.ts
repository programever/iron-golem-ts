import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { parseJsonc } from '../data/jsonc';

export function runTsc<T>(parser: (s: string | null) => T): T {
  const tsConfigPath = path.resolve('./tsconfig.json');
  if (!fs.existsSync(tsConfigPath)) {
    throw new Error('💀 tsconfig.json not found');
  }

  // Snapshot the exact bytes so the file can be restored without going through
  // git, which would also wipe any uncommitted edits the user has made to it.
  const originalTsConfig = fs.readFileSync(tsConfigPath, 'utf8');
  const tscBin = resolveTscBin();
  writeStrictTsConfig(tsConfigPath, originalTsConfig);

  try {
    execSync(`${tscBin} --noEmit`, { stdio: 'pipe' });
    return parser(null);
  } catch (error) {
    return parser(readTscErrorOutput(error));
  } finally {
    fs.writeFileSync(tsConfigPath, originalTsConfig, 'utf8');
  }
}

/**
 * A failed `tsc` run and a missing `tsc` binary both throw, so only treat the
 * failure as a compile result when it actually reported something on stdout.
 */
function readTscErrorOutput(error: unknown): string {
  const stdout = hasProperty(error, 'stdout') ? String(error.stdout ?? '') : '';
  if (stdout.trim() !== '') {
    return stdout;
  }

  const stderr = hasProperty(error, 'stderr') ? String(error.stderr ?? '').trim() : '';
  const detail = stderr === '' ? (error instanceof Error ? error.message : String(error)) : stderr;
  throw new Error(`💀 An unknown error occurred while running TSC: ${detail}`);
}

function hasProperty<K extends string>(value: unknown, key: K): value is Record<K, unknown> {
  return typeof value === 'object' && value !== null && key in value;
}

/**
 * Prefer the audited project's own compiler. Resolving `tsc` off `PATH` picks
 * up whatever is installed globally, which is the wrong version when auditing
 * historical commits.
 */
function resolveTscBin(): string {
  const localBin = findLocalTscBin(process.cwd());
  return localBin === null ? 'npx --no-install tsc' : JSON.stringify(localBin);
}

function findLocalTscBin(dir: string): string | null {
  const candidate = path.join(dir, 'node_modules', '.bin', 'tsc');
  if (fs.existsSync(candidate)) {
    return candidate;
  }

  const parent = path.dirname(dir);
  return parent === dir ? null : findLocalTscBin(parent);
}

function writeStrictTsConfig(tsConfigPath: string, originalTsConfig: string): void {
  const tsConfig = parseJsonc(originalTsConfig);
  if (typeof tsConfig !== 'object' || tsConfig === null || Array.isArray(tsConfig)) {
    throw new Error('💀 tsconfig.json is not a JSON object');
  }

  const config = tsConfig as Record<string, unknown>;
  const compilerOptions = config.compilerOptions;
  const strictConfig = {
    ...config,
    compilerOptions: {
      ...(typeof compilerOptions === 'object' && compilerOptions !== null ? compilerOptions : {}),
      strict: true,
      strictNullChecks: true
    }
  };

  fs.writeFileSync(tsConfigPath, JSON.stringify(strictConfig, null, 2), 'utf8');
}

export type TscErrorLine = { filePath: string; errorCode: number };

// The path is matched greedily rather than as "non-space, non-paren" so that
// file names containing spaces or parentheses are not silently dropped.
const TSC_ERROR_LINE = /^(.+)\((\d+),(\d+)\): error TS(\d+):/;

export function parseTscErrorLine(line: string): TscErrorLine | null {
  const match = TSC_ERROR_LINE.exec(line);
  if (match === null) {
    return null;
  }

  const filePath = match[1];
  const errorCode = match[4];
  if (filePath === undefined || errorCode === undefined) {
    return null;
  }

  return { filePath: filePath.trim(), errorCode: parseInt(errorCode, 10) };
}

/**
EG:
{
  "src/test-utils.tsx": [ 2322, 2345 ],
  "src/config/axios.ts": [ 66 ],
  "jest.setup.ts": [ 18 ],
}
*/
export function parseTscErrors(tscOutput: string): Record<string, number[]> {
  const errorsByFile: Record<string, number[]> = {};

  for (const line of tscOutput.split('\n')) {
    const parsed = parseTscErrorLine(line);
    if (parsed === null) {
      continue;
    }

    const existing = errorsByFile[parsed.filePath];
    if (existing === undefined) {
      errorsByFile[parsed.filePath] = [parsed.errorCode];
    } else {
      existing.push(parsed.errorCode);
    }
  }

  return errorsByFile;
}

export type NodeTS = {
  name: string;
  errorCount: number;
  children: Map<string, NodeTS>;
};
export function buildNodeFromErrors(errorsByFile: Record<string, number[]>): NodeTS {
  const root: NodeTS = { name: '', errorCount: 0, children: new Map() };

  for (const [filePath, errors] of Object.entries(errorsByFile)) {
    const parts = filePath.split('/'); // Split file path into directory components
    let currentNode = root;

    for (const part of parts) {
      const existing = currentNode.children.get(part);
      const child = existing ?? { name: part, errorCount: 0, children: new Map() };
      if (existing === undefined) {
        currentNode.children.set(part, child);
      }
      currentNode = child;
    }

    // For the leaf node (the file), add the error count based on its error codes
    currentNode.errorCount += errors.length;
  }

  // Update error counts for all parent nodes recursively
  function updateErrorCounts(node: NodeTS): number {
    let totalErrorCount = node.errorCount;

    for (const child of node.children.values()) {
      totalErrorCount += updateErrorCounts(child);
    }

    node.errorCount = totalErrorCount; // Propagate aggregated error count up the tree
    return totalErrorCount;
  }

  updateErrorCounts(root);
  return root;
}
