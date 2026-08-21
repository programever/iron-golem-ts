import { strict as assert } from 'node:assert';
import { after, before, describe, it } from 'node:test';
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/**
 * End-to-end: builds the real CLI, then drives it against a throwaway git
 * repository with backdated commits. This is the closest thing to "does the
 * package actually work" short of installing it from npm.
 */

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const CLI = path.join(REPO_ROOT, 'dist', 'index.js');
const TYPESCRIPT_DIR = path.dirname(require.resolve('typescript/package.json'));

const ERROR_A = 'export const a: number = "x";\n';
const ERROR_B = 'export const b: string = 1;\n';
const CLEAN_B = 'export const b: string = "ok";\n';

type RunResult = { status: number; stdout: string; stderr: string };

let fixture: string;

// Isolate from the developer's global git config (signing, hooks, templates).
const gitEnv = {
  ...process.env,
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_AUTHOR_NAME: 'e2e',
  GIT_AUTHOR_EMAIL: 'e2e@example.com',
  GIT_COMMITTER_NAME: 'e2e',
  GIT_COMMITTER_EMAIL: 'e2e@example.com'
};

function git(args: string[], extraEnv: Record<string, string> = {}): string {
  return execFileSync('git', args, {
    cwd: fixture,
    env: { ...gitEnv, ...extraEnv },
    encoding: 'utf-8',
    stdio: 'pipe'
  }).trim();
}

function runCli(args: string[], extraEnv: Record<string, string> = {}): RunResult {
  try {
    const stdout = execFileSync(process.execPath, [CLI, ...args], {
      cwd: fixture,
      env: { ...gitEnv, ...extraEnv },
      encoding: 'utf-8',
      stdio: 'pipe'
    });
    return { status: 0, stdout, stderr: '' };
  } catch (error) {
    const failure = error as { status?: number; stdout?: string; stderr?: string };
    return {
      status: failure.status ?? 1,
      stdout: failure.stdout ?? '',
      stderr: failure.stderr ?? ''
    };
  }
}

function writeSource(content: string): void {
  fs.writeFileSync(path.join(fixture, 'src', 'a.ts'), content);
}

function daysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

before(() => {
  execFileSync('npm', ['run', 'build'], { cwd: REPO_ROOT, stdio: 'pipe' });
  assert.ok(fs.existsSync(CLI), `expected build output at ${CLI}`);

  fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'iron-golem-e2e-'));
  fs.mkdirSync(path.join(fixture, 'src'));

  // The audit runs `npm ci` at every commit, so the fixture needs a real
  // lockfile. A `file:` dependency on the repo's own TypeScript keeps that
  // fully offline and fast.
  fs.writeFileSync(
    path.join(fixture, 'package.json'),
    JSON.stringify(
      {
        name: 'fixture',
        version: '1.0.0',
        private: true,
        devDependencies: { typescript: `file:${TYPESCRIPT_DIR}` }
      },
      null,
      2
    )
  );
  // Deliberately non-strict: the CLI must force strict mode itself.
  fs.writeFileSync(
    path.join(fixture, 'tsconfig.json'),
    [
      '{',
      '  // comments are legal in tsconfig and must survive',
      '  "compilerOptions": { "target": "ES2020", "module": "CommonJS", "strict": false },',
      '  "include": ["src"],',
      '}',
      ''
    ].join('\n')
  );
  fs.writeFileSync(path.join(fixture, '.gitignore'), 'node_modules/\ntmp/\n');
  execFileSync('npm', ['install', '--silent', '--no-audit', '--no-fund', '--offline'], {
    cwd: fixture,
    stdio: 'pipe'
  });

  git(['init', '-q', '-b', 'main']);

  const old = daysAgo(60);
  writeSource(ERROR_A + ERROR_B);
  git(['add', '-A']);
  git(['commit', '-qm', 'old: two errors'], { GIT_AUTHOR_DATE: old, GIT_COMMITTER_DATE: old });

  writeSource(ERROR_A + CLEAN_B);
  git(['commit', '-qam', 'new: one error']);
});

after(() => {
  if (fixture) {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});

describe('iron-golem-ts -k changes', () => {
  it('exits 0 with a clean tree', () => {
    const result = runCli(['-k', 'changes']);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /No TypeScript Error/);
  });

  it('exits 1 and lists the error when a changed file is broken', () => {
    const broken = path.join(fixture, 'src', 'c.ts');
    fs.writeFileSync(broken, 'export const c: boolean = 1;\n');
    try {
      const result = runCli(['-k', 'changes']);
      assert.equal(result.status, 1);
      assert.match(result.stderr, /src\/c\.ts\(1,14\): error TS2322/);
      // Errors in untouched files must not be reported.
      assert.doesNotMatch(result.stderr, /src\/a\.ts/);
    } finally {
      fs.rmSync(broken);
    }
  });

  it('leaves tsconfig.json byte-for-byte intact, comments included', () => {
    const tsconfigPath = path.join(fixture, 'tsconfig.json');
    const before = fs.readFileSync(tsconfigPath, 'utf-8');
    runCli(['-k', 'changes']);
    assert.equal(fs.readFileSync(tsconfigPath, 'utf-8'), before);
    assert.equal(git(['status', '--porcelain']), '');
  });
});

describe('iron-golem-ts -k report', () => {
  it('prints the error tree for the current commit', () => {
    const result = runCli(['-k', 'report', '-rp', '/', '-rd', '3']);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /\(root\): 1 - 100%/);
    assert.match(result.stdout, /a\.ts: 1 - 100%/);
  });

  it('fails clearly for a path that does not exist', () => {
    const result = runCli(['-k', 'report', '-rp', '/nope']);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /does not exist/);
  });
});

describe('iron-golem-ts -k audit', () => {
  it('walks history, writes the report and cache, and restores the branch', () => {
    const result = runCli(['-k', 'audit', '-s', '30', '-m', '3']);
    assert.equal(result.status, 0, result.stderr);

    // Target dates: today, -30d, -60d, -90d. Today -> new commit; -30d and
    // -60d both resolve to the old commit and are de-duplicated; -90d -> none.
    assert.match(result.stdout, /Error: 1\n/);
    assert.match(result.stdout, /Error: 2\n/);

    const outDir = path.join(fixture, 'tmp', 'iron-golem-ts');
    assert.ok(fs.existsSync(path.join(outDir, 'report.html')));

    const cache: Record<string, { errors: Record<string, number[]> }> = JSON.parse(
      fs.readFileSync(path.join(outDir, 'cache.json'), 'utf-8')
    );
    const counts = Object.values(cache)
      .map((entry) => Object.values(entry.errors).flat().length)
      .sort();
    assert.deepEqual(counts, [1, 2]);

    assert.equal(git(['rev-parse', '--abbrev-ref', 'HEAD']), 'main');
    assert.equal(git(['status', '--porcelain']), '');
    assert.equal(git(['log', '--format=%s', '-1']), 'new: one error');
  });

  it('refuses to run with uncommitted changes', () => {
    const stray = path.join(fixture, 'src', 'stray.ts');
    fs.writeFileSync(stray, 'export const stray = 1;\n');
    try {
      const result = runCli(['-k', 'audit', '-s', '30', '-m', '3']);
      assert.equal(result.status, 1);
      assert.match(result.stderr, /Uncommitted changes/);
    } finally {
      fs.rmSync(stray);
    }
  });
});

describe('argument validation', () => {
  it('rejects a zero sequence instead of looping forever', () => {
    const result = runCli(['-k', 'audit', '-s', '0']);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /sequence/);
  });

  it('rejects an unknown kind', () => {
    const result = runCli(['-k', 'bogus']);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /audit.*changes.*report/);
  });
});

describe('iron-golem-ts -k audit install strategies', () => {
  // A fresh output directory outside the fixture, so the cache from the main
  // audit test is not reused and the fixture's tree stays clean.
  function freshOutDir(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'iron-golem-e2e-out-'));
  }

  it('--skip-install reuses the existing node_modules', () => {
    const out = freshOutDir();
    try {
      const result = runCli(['-k', 'audit', '-s', '30', '-m', '3', '-p', out, '--skip-install']);
      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stdout, /Skipping dependency install/);
      assert.ok(fs.existsSync(path.join(out, 'iron-golem-ts', 'report.html')));
      assert.equal(git(['status', '--porcelain']), '');
    } finally {
      fs.rmSync(out, { recursive: true, force: true });
    }
  });

  it('--install-command runs the given command at every commit and on restore', () => {
    const out = freshOutDir();
    const marker = path.join(out, 'installs.log');
    // Appends one line per invocation; reads the path from the environment so
    // no quoting survives the shell round-trip.
    const command = `node -e "require('fs').appendFileSync(process.env.MARKER, 'x\\n')"`;
    try {
      const result = runCli(
        ['-k', 'audit', '-s', '30', '-m', '3', '-p', out, '--install-command', command],
        { MARKER: marker }
      );
      assert.equal(result.status, 0, result.stderr);

      // Two distinct commits are audited, plus the final restore of `main`.
      const runs = fs.readFileSync(marker, 'utf-8').split('\n').filter(Boolean).length;
      assert.equal(runs, 3);
      assert.equal(git(['status', '--porcelain']), '');
    } finally {
      fs.rmSync(out, { recursive: true, force: true });
    }
  });

  it('rejects --skip-install together with --install-command', () => {
    const result = runCli(['-k', 'audit', '--skip-install', '--install-command', 'true']);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /cannot be used together/);
  });
});
