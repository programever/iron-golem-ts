import * as fs from 'fs';
import * as path from 'path';
import { parseJsonc } from '../data/jsonc';

export type PackageManager = 'npm' | 'yarn' | 'yarn-berry' | 'pnpm' | 'bun';

/** How the audit installs dependencies after checking out each commit. */
export type InstallStrategy =
  | { type: 'auto' } // detect from the commit's lockfile / package.json
  | { type: 'command'; command: string } // user-supplied command
  | { type: 'skip' }; // reuse whatever node_modules is already there

const INSTALL_COMMANDS: Record<PackageManager, string> = {
  npm: 'npm ci --silent',
  yarn: 'yarn install --frozen-lockfile --silent',
  'yarn-berry': 'yarn install --immutable',
  pnpm: 'pnpm install --frozen-lockfile --silent',
  bun: 'bun install --frozen-lockfile'
};

/**
 * Works out which package manager a project uses. The `packageManager` field
 * in package.json is authoritative when present; otherwise the lockfile
 * decides. Detection runs per commit, because projects switch tools over time.
 */
export function detectPackageManager(dir: string): PackageManager {
  const declared = readDeclaredPackageManager(dir);
  if (declared !== null) {
    return declared;
  }

  const has = (file: string): boolean => fs.existsSync(path.join(dir, file));

  if (has('pnpm-lock.yaml')) return 'pnpm';
  if (has('bun.lock') || has('bun.lockb')) return 'bun';
  if (has('yarn.lock')) return has('.yarnrc.yml') ? 'yarn-berry' : 'yarn';
  return 'npm';
}

function readDeclaredPackageManager(dir: string): PackageManager | null {
  const packageJsonPath = path.join(dir, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = parseJsonc(fs.readFileSync(packageJsonPath, 'utf-8'));
  } catch {
    return null;
  }

  if (typeof parsed !== 'object' || parsed === null || !('packageManager' in parsed)) {
    return null;
  }

  const field = parsed.packageManager;
  return typeof field === 'string' ? parsePackageManagerField(field) : null;
}

/** Parses values like `yarn@3.6.1`, `pnpm@8.15.0+sha256...`, `npm@10.2.0`. */
export function parsePackageManagerField(field: string): PackageManager | null {
  const match = /^(npm|yarn|pnpm|bun)@(\d+)/.exec(field.trim());
  if (match === null) {
    return null;
  }

  const name = match[1];
  const major = parseInt(match[2] ?? '0', 10);

  switch (name) {
    case 'npm':
      return 'npm';
    case 'pnpm':
      return 'pnpm';
    case 'bun':
      return 'bun';
    case 'yarn':
      return major >= 2 ? 'yarn-berry' : 'yarn';
    default:
      return null;
  }
}

export function installCommandFor(manager: PackageManager): string {
  return INSTALL_COMMANDS[manager];
}

/** The shell command to run for this strategy in `dir`, or `null` to skip. */
export function resolveInstallCommand(strategy: InstallStrategy, dir: string): string | null {
  switch (strategy.type) {
    case 'skip':
      return null;
    case 'command':
      return strategy.command;
    case 'auto':
      return installCommandFor(detectPackageManager(dir));
  }
}
