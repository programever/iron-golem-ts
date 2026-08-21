import { strict as assert } from 'node:assert';
import { afterEach, beforeEach, describe, it } from 'node:test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  detectPackageManager,
  installCommandFor,
  parsePackageManagerField,
  resolveInstallCommand
} from '../../src/lib/packageManager';

let dir: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'iron-golem-pm-'));
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

function touch(name: string, content = ''): void {
  fs.writeFileSync(path.join(dir, name), content);
}

describe('detectPackageManager', () => {
  it('defaults to npm when there is no lockfile', () => {
    assert.equal(detectPackageManager(dir), 'npm');
  });

  it('detects each lockfile', () => {
    touch('package-lock.json');
    assert.equal(detectPackageManager(dir), 'npm');

    touch('yarn.lock');
    assert.equal(detectPackageManager(dir), 'yarn');

    touch('.yarnrc.yml');
    assert.equal(detectPackageManager(dir), 'yarn-berry');

    touch('bun.lockb');
    assert.equal(detectPackageManager(dir), 'bun');

    touch('pnpm-lock.yaml');
    assert.equal(detectPackageManager(dir), 'pnpm');
  });

  it('lets the packageManager field override the lockfile', () => {
    touch('yarn.lock');
    touch('package.json', JSON.stringify({ packageManager: 'pnpm@8.15.0+sha256.abc' }));
    assert.equal(detectPackageManager(dir), 'pnpm');
  });

  it('ignores a malformed package.json', () => {
    touch('yarn.lock');
    touch('package.json', '{ not json');
    assert.equal(detectPackageManager(dir), 'yarn');
  });
});

describe('parsePackageManagerField', () => {
  it('distinguishes yarn classic from berry by major version', () => {
    assert.equal(parsePackageManagerField('yarn@1.22.19'), 'yarn');
    assert.equal(parsePackageManagerField('yarn@3.6.1'), 'yarn-berry');
    assert.equal(parsePackageManagerField('yarn@4.0.0'), 'yarn-berry');
  });

  it('parses the other managers and rejects unknown values', () => {
    assert.equal(parsePackageManagerField('npm@10.2.0'), 'npm');
    assert.equal(parsePackageManagerField('bun@1.1.0'), 'bun');
    assert.equal(parsePackageManagerField('cargo@1.0.0'), null);
    assert.equal(parsePackageManagerField('yarn'), null);
  });
});

describe('installCommandFor', () => {
  it('uses a lockfile-respecting install for every manager', () => {
    assert.equal(installCommandFor('npm'), 'npm ci --silent');
    assert.match(installCommandFor('yarn'), /--frozen-lockfile/);
    assert.match(installCommandFor('yarn-berry'), /--immutable/);
    assert.match(installCommandFor('pnpm'), /--frozen-lockfile/);
    assert.match(installCommandFor('bun'), /--frozen-lockfile/);
  });
});

describe('resolveInstallCommand', () => {
  it('returns null for skip, the given command for command, and detects for auto', () => {
    assert.equal(resolveInstallCommand({ type: 'skip' }, dir), null);
    assert.equal(
      resolveInstallCommand({ type: 'command', command: 'make deps' }, dir),
      'make deps'
    );
    touch('pnpm-lock.yaml');
    assert.equal(
      resolveInstallCommand({ type: 'auto' }, dir),
      'pnpm install --frozen-lockfile --silent'
    );
  });
});
