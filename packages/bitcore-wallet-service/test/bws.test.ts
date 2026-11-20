import { spawn, spawnSync } from 'child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { expect } from 'chai';

describe('BWS process lifecycle', function() {
  this.timeout(15000);

  function runBws(script: string, flags: string[] = []) {
    // Skip database initialization while exercising the executable's handlers.
    return spawnSync(process.execPath, [...flags, '-e', `
      const { ExpressApp } = require(${JSON.stringify(require.resolve('../src/lib/expressapp'))});
      const config = require(${JSON.stringify(require.resolve('../src/config'))}).default;
      config.cluster = false;
      ExpressApp.prototype.start = function() {};
      require(${JSON.stringify(require.resolve('../src/bws'))});
      ${script}
    `], {
      encoding: 'utf8',
      timeout: 10000,
      env: { ...process.env, BITCORE_CONFIG_PATH: '/nonexistent', BWS_CONFIG_PATH: '/nonexistent', BWS_PORT: '0' }
    });
  }

  it('should log an uncaught callback error and exit unsuccessfully', function() {
    const result = runBws('setImmediate(() => { throw new Error("callback failure"); });');
    expect(result.error).to.equal(undefined);
    expect(result.status).to.equal(1);
    expect(result.stderr).to.include('BWS fatal error').and.include('Error: callback failure').and.include('at ');
  });

  it('should log and exit on an unhandled rejection even in warn mode', function() {
    const result = runBws('Promise.reject({ message: "rejection failure" }); setInterval(() => {}, 1000);', ['--unhandled-rejections=warn']);
    expect(result.error).to.equal(undefined);
    expect(result.status).to.equal(1);
    expect(result.stderr).to.include('BWS fatal error').and.include('rejection failure');
  });

  it('should leave handled rejections alone', function() {
    const result = runBws('Promise.reject(new Error("handled")).catch(() => console.log("handled successfully"));');
    expect(result.error).to.equal(undefined);
    expect(result.status).to.equal(0);
    expect(result.stdout).to.include('handled successfully');
    expect(result.stderr).not.to.include('BWS fatal error');
  });

  for (const exitCode of [0, 23]) {
    it(`should let the Docker launcher exit with BWS status ${exitCode}`, async function() {
      const dir = mkdtempSync(path.join(tmpdir(), 'bws-launcher-'));
      const src = path.join(dir, 'ts_build/src');
      const services = ['messagebroker', 'bcmonitor', 'emailservice', 'pushnotificationsservice', 'fiatrateservice'];
      for (const service of services) {
        mkdirSync(path.join(src, service), { recursive: true });
        writeFileSync(path.join(src, service, `${service}.js`), 'process.exit(0);');
      }
      writeFileSync(path.join(src, 'bws.js'), `process.exit(${exitCode});`);

      const child = spawn('bash', [path.resolve(__dirname, '../../start-docker.sh')], {
        cwd: dir,
        detached: true,
        stdio: 'ignore',
        env: { ...process.env, PATH: `${path.dirname(process.execPath)}:${process.env.PATH}` }
      });
      try {
        const status = await new Promise<number | null>((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('Launcher stayed alive after BWS exited')), 3000);
          child.once('error', err => { clearTimeout(timer); reject(err); });
          child.once('exit', code => { clearTimeout(timer); resolve(code); });
        });
        expect(status).to.equal(exitCode);
      } finally {
        // The host does not reap the container's background services for us.
        if (child.pid !== undefined) {
          try {
            process.kill(-child.pid, 'SIGKILL');
          } catch (err) {
            expect(err).to.have.property('code', 'ESRCH');
          }
        }
        rmSync(dir, { recursive: true, force: true });
      }
    });
  }
});
