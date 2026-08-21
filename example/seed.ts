/**
 * Seeds a fake TypeScript project with three months of weekly commits whose
 * strict-mode error count rises and then falls, then runs the audit on it so
 * the HTML report has a real story to show.
 *
 *   npm run example                # writes tmp/example-project/
 *   npm run example -- <dir>       # custom target directory
 *
 * The project gets its own throwaway git repository; this repo is untouched.
 * Fully offline: TypeScript is linked from this repo's node_modules.
 */
import { execFileSync, StdioOptions } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const REPO_ROOT = path.resolve(__dirname, '..');
const CLI = path.join(REPO_ROOT, 'dist', 'index.js');
const TYPESCRIPT_DIR = path.dirname(require.resolve('typescript/package.json'));
const target = path.resolve(process.argv[2] ?? path.join(REPO_ROOT, 'tmp', 'example-project'));

type Snippet = (n: number) => string;

// One snippet per error kind. `n` keeps identifiers unique within a file.
const SNIPPETS: Record<string, Snippet> = {
  typeMismatch: (n) => `export const price${n}: number = "free";`,
  possiblyNull: (n) => `export function len${n}(s: string | null) { return s.length; }`,
  possiblyUndefined: (n) => `export function upper${n}(s?: string) { return s.toUpperCase(); }`,
  badArgument: (n) =>
    `function pay${n}(cents: number) { return cents; }\nexport const paid${n} = pay${n}("12");`,
  implicitAny: (n) => `export function handle${n}(event) { return event.target; }`,
  unknownName: (n) => `export const total${n} = subtotal${n} + 1;`,
  missingProperty: (n) => `export const email${n} = ({ name: "a" } as { name: string }).email;`,
  missingArgument: (n) =>
    `function greet${n}(name: string) { return name; }\nexport const hi${n} = greet${n}();`
};
const KINDS = Object.keys(SNIPPETS);

const FILES = [
  'src/api/client.ts',
  'src/api/auth.ts',
  'src/components/OrderTable.ts',
  'src/components/CheckoutForm.ts',
  'src/store/cart.ts',
  'src/utils/date.ts',
  'src/utils/format.ts'
];

// Weekly error totals, oldest first: a strict-mode migration that gets worse
// before the team starts paying it down.
const WEEKLY_TOTALS = [6, 9, 14, 22, 31, 38, 42, 40, 33, 27, 19, 14, 11];

// Small deterministic PRNG so every run produces the same project.
let seed = 42;
function random(): number {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
}

function pick<T>(items: T[]): T {
  const item = items[Math.floor(random() * items.length)];
  if (item === undefined) {
    throw new Error('pick() called with an empty list');
  }
  return item;
}

function distribute(total: number): Map<string, string[]> {
  const perFile = new Map<string, string[]>(FILES.map((f) => [f, []]));
  for (let i = 0; i < total; i++) {
    perFile.get(pick(FILES))?.push(pick(KINDS));
  }
  return perFile;
}

function writeProjectState(perFile: Map<string, string[]>): void {
  for (const [file, kinds] of perFile) {
    const abs = path.join(target, file);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    const body = kinds.map((kind, i) => SNIPPETS[kind]?.(i) ?? '').join('\n\n');
    fs.writeFileSync(abs, `// ${file}\nexport {};\n\n${body}\n`);
  }
}

// Midnight local time: git reads a date-only `--before=<yyyy-MM-dd>` as that
// date at the *current* clock time, so a commit stamped later in the day would
// only be picked up by audits run after that hour.
function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

// Isolate from the developer's global git config (signing, hooks, templates).
const env: NodeJS.ProcessEnv = {
  ...process.env,
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_AUTHOR_NAME: 'Example Dev',
  GIT_AUTHOR_EMAIL: 'dev@example.com',
  GIT_COMMITTER_NAME: 'Example Dev',
  GIT_COMMITTER_EMAIL: 'dev@example.com'
};

function run(
  cmd: string,
  args: string[],
  extraEnv: NodeJS.ProcessEnv = {},
  stdio: StdioOptions = 'pipe'
): void {
  execFileSync(cmd, args, { cwd: target, env: { ...env, ...extraEnv }, stdio });
}

function main(): void {
  if (!fs.existsSync(CLI)) {
    throw new Error(`Build the CLI first: npm run build (expected ${CLI})`);
  }

  fs.rmSync(target, { recursive: true, force: true });
  fs.mkdirSync(target, { recursive: true });

  fs.writeFileSync(
    path.join(target, 'package.json'),
    JSON.stringify(
      {
        name: 'example-project',
        version: '1.0.0',
        private: true,
        devDependencies: { typescript: `file:${TYPESCRIPT_DIR}` }
      },
      null,
      2
    )
  );
  fs.writeFileSync(
    path.join(target, 'tsconfig.json'),
    [
      '{',
      '  // Not strict on purpose: iron-golem-ts forces strict mode during the audit.',
      '  "compilerOptions": { "target": "ES2020", "module": "CommonJS", "strict": false },',
      '  "include": ["src"]',
      '}',
      ''
    ].join('\n')
  );
  fs.writeFileSync(path.join(target, '.gitignore'), 'node_modules/\ntmp/\n');
  run('npm', ['install', '--silent', '--no-audit', '--no-fund', '--offline']);
  run('git', ['init', '-q', '-b', 'main']);

  const weeks = WEEKLY_TOTALS.length;
  WEEKLY_TOTALS.forEach((total, index) => {
    const date = daysAgo((weeks - 1 - index) * 7);
    writeProjectState(distribute(total));
    run('git', ['add', '-A']);
    run('git', ['commit', '-qm', `week ${index + 1}: ${total} strict errors`], {
      GIT_AUTHOR_DATE: date,
      GIT_COMMITTER_DATE: date
    });
  });

  console.info(`Seeded ${weeks} weekly commits in ${target}`);
  console.info('Running audit...\n');
  run(process.execPath, [CLI, '-k', 'audit', '-s', '7', '-m', '3'], {}, 'inherit');

  console.info(`\nOpen: ${path.join(target, 'tmp', 'iron-golem-ts', 'report.html')}`);
}

main();
