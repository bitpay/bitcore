import assert from 'assert';
import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

describe('Published package', function() {
  this.timeout(30000);

  it('ships and runs the CLI subcommands from the packed artifact', function() {
    const packageDir = path.resolve(__dirname, '../../..');
    const temporaryDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bitcore-client-package-'));
    try {
      const [packed] = JSON.parse(execFileSync('npm', [
        'pack', '--json', '--ignore-scripts', '--workspaces=false',
        '--pack-destination', temporaryDir, '--cache', path.join(temporaryDir, 'npm-cache')
      ], { cwd: packageDir, encoding: 'utf8' }));
      const files = new Set(packed.files.map((file: { path: string }) => file.path));
      for (const file of fs.readdirSync(path.join(packageDir, 'bin'), { recursive: true, encoding: 'utf8' })) {
        if (fs.statSync(path.join(packageDir, 'bin', file)).isFile()) {
          assert.ok(files.has(`bin/${file}`), `packed package is missing bin/${file}`);
        }
      }

      execFileSync('tar', ['-xzf', path.join(temporaryDir, packed.filename), '-C', temporaryDir]);
      const unpackedDir = path.join(temporaryDir, 'package');
      // Reuse installed dependencies, including package-local version conflicts.
      // The application files themselves must all come from the tarball.
      fs.symlinkSync(path.resolve(packageDir, '../../node_modules'), path.join(temporaryDir, 'node_modules'), 'dir');
      const nestedModules = path.join(packageDir, 'node_modules');
      if (fs.existsSync(nestedModules)) {
        fs.symlinkSync(nestedModules, path.join(unpackedDir, 'node_modules'), 'dir');
      }
      for (const command of ['create', 'balance', 'send', 'sign']) {
        const output = execFileSync(process.execPath, ['bin/wallet', command, '--help'], {
          cwd: unpackedDir, encoding: 'utf8', timeout: 10000
        });
        assert.match(output, new RegExp(`Usage: wallet-${command}`));
      }
    } finally {
      fs.rmSync(temporaryDir, { recursive: true, force: true });
    }
  });
});
