import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

export function runTsc<T>(parser: (s: string | null) => T): T {
  const tsConfigPath = path.resolve('./tsconfig.json');
  if (!fs.existsSync(tsConfigPath)) {
    throw new Error('tsconfig.json not found');
  }

  updateTsConfig();

  try {
    execSync('tsc --noEmit', { stdio: 'pipe' }).toString();
    return parser(null);
  } catch (error) {
    if (error instanceof Error && 'stdout' in error && error.stdout) {
      return parser(error.stdout.toString());
    } else {
      throw new Error('💀 An unknown error occurred while running TSC');
    }
  } finally {
    resetTsConfig();
  }
}

export function updateTsConfig(): void {
  const tsConfigPath = path.resolve('./tsconfig.json');
  if (!fs.existsSync(tsConfigPath)) {
    throw new Error('💀 tsconfig.json not found');
  }

  const tsConfig = JSON.parse(fs.readFileSync(tsConfigPath, 'utf8'));
  tsConfig.compilerOptions = {
    ...tsConfig.compilerOptions,
    strict: true,
    strictNullChecks: true
  };

  fs.writeFileSync(tsConfigPath, JSON.stringify(tsConfig, null, 2));
}

export function resetTsConfig(): void {
  execSync('git checkout ./tsconfig.json', { stdio: 'pipe' }).toString();
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
  const regex = /^([^\s()]+)\(\d+,\d+\): error TS(\d+):/gm;
  let match;

  while ((match = regex.exec(tscOutput)) !== null) {
    const filePath = match[1].trim();
    const errorCode = parseInt(match[2], 10);

    if (!errorsByFile[filePath]) {
      errorsByFile[filePath] = [];
    }

    errorsByFile[filePath].push(errorCode);
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
      if (!currentNode.children.has(part)) {
        currentNode.children.set(part, { name: part, errorCount: 0, children: new Map() });
      }
      currentNode = currentNode.children.get(part)!;
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
