import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { expect } from 'chai';

// How the package looks from outside: the exports map, typesVersions and the CommonJS build have to
// serve ESM consumers, CommonJS consumers and both flavours of TypeScript consumer alike. Everything
// below resolves the package by its own name, so it goes through the same package.json a consumer
// would, with no reliance on relative paths into ts_build.

const PKG = '@bitpay-labs/crypto-rpc';
// ts_build/test -> package root
const packageRoot = path.resolve(__dirname, '..', '..');

// Deep paths bitcore-node imports, with the export each one must carry
const deepPaths: { [subpath: string]: string } = {
  'lib/sol/error_messages': 'SOL_ERROR_MESSAGES',
  'lib/sol/transaction-parser': 'parseInstructions',
  'lib/sol/SolRpc': 'SolRpc',
  'lib/eth/EthRpc': 'EthRpc',
  'lib/xrp/XrpRpc': 'XrpRpc',
};

// The specifiers are kept out of TypeScript's sight so these stay plain runtime module lookups
const importEsm = (specifier: string): Promise<any> => import(specifier);
// eslint-disable-next-line @typescript-eslint/no-require-imports
const requireCjs = (id: string): any => require(id);

const offlineConfigs: { [chain: string]: object } = {
  BTC: { chain: 'BTC', host: '127.0.0.1', protocol: 'http', port: 8332, user: 'user', pass: 'pass' },
  BCH: { chain: 'BCH', host: '127.0.0.1', protocol: 'http', port: 8332, user: 'user', pass: 'pass' },
  LTC: { chain: 'LTC', host: '127.0.0.1', protocol: 'http', port: 9332, user: 'user', pass: 'pass' },
  DOGE: { chain: 'DOGE', host: '127.0.0.1', protocol: 'http', port: 22555, user: 'user', pass: 'pass' },
  ETH: { chain: 'ETH', host: '127.0.0.1', protocol: 'http', port: 8545 },
  MATIC: { chain: 'MATIC', host: '127.0.0.1', protocol: 'http', port: 8545 },
  XRP: { chain: 'XRP', host: '127.0.0.1', protocol: 'ws', port: 6006 },
  SOL: { chain: 'SOL', host: '127.0.0.1', protocol: 'http', port: 8899, wsPort: 8900 },
};

describe('package consumers', function() {
  // The first import() loads the whole package, crypto-wallet-core included, which can take a few seconds
  this.timeout(30000);

  describe('ES module consumer', function() {
    it('keeps dynamic import() in the compiled test, so this really is the ESM loader', function() {
      const compiled = fs.readFileSync(__filename, 'utf8');
      expect(compiled).to.match(/import\(specifier\)/);
      expect(compiled).to.not.match(/require\(specifier\)/);
    });

    it('serves CryptoRpc and utils as named imports from the root', async function() {
      const { CryptoRpc, utils } = await importEsm(PKG);
      expect(CryptoRpc).to.be.a('function');
      expect(utils.toBI).to.be.a('function');
      expect(utils.toBI('5')).to.equal(5n);
    });

    it('serves the whole module as the default import', async function() {
      const mod = await importEsm(PKG);
      expect(mod.default).to.be.an('object');
      expect(mod.default.CryptoRpc).to.equal(mod.CryptoRpc);
      expect(mod.default.utils).to.equal(mod.utils);
    });

    it('lists the named exports on the namespace import', async function() {
      const mod = await importEsm(PKG);
      expect(Object.keys(mod)).to.include.members(['CryptoRpc', 'utils', 'default']);
    });

    for (const [subpath, exportName] of Object.entries(deepPaths)) {
      it(`serves ${subpath} with and without .js`, async function() {
        const bare = await importEsm(`${PKG}/${subpath}`);
        const suffixed = await importEsm(`${PKG}/${subpath}.js`);
        expect(bare[exportName], exportName).to.exist;
        expect(suffixed[exportName]).to.equal(bare[exportName]);
      });
    }

    for (const [chain, config] of Object.entries(offlineConfigs)) {
      it(`constructs a ${chain} client and returns it from get()`, async function() {
        const { CryptoRpc } = await importEsm(PKG);
        const rpc = new CryptoRpc(config);
        expect(rpc.chain).to.equal(chain);
        expect(rpc.get()).to.equal(rpc.rpcs[chain]);
        expect(rpc.get(chain)).to.equal(rpc.rpcs[chain]);
        expect(rpc.has(chain)).to.equal(true);
      });
    }

    it('treats an unknown chain as EVM when asked', async function() {
      const { CryptoRpc } = await importEsm(PKG);
      const { EthRpc } = await importEsm(`${PKG}/lib/eth/EthRpc`);
      const rpc = new CryptoRpc({ chain: 'ARB', isEVM: true, host: '127.0.0.1', protocol: 'http', port: 8545 });
      expect(rpc.get('ARB')).to.be.instanceOf(EthRpc);
    });

    it('builds token clients next to the chain client', async function() {
      const { CryptoRpc } = await importEsm(PKG);
      const { EthRpc } = await importEsm(`${PKG}/lib/eth/EthRpc`);
      const { SolRpc } = await importEsm(`${PKG}/lib/sol/SolRpc`);
      const eth = new CryptoRpc({
        ...offlineConfigs.ETH,
        tokens: { USDC: { type: 'ERC20', tokenContractAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' } }
      });
      expect(eth.get('USDC')).to.be.instanceOf(EthRpc);
      expect(eth.get('USDC')).to.not.equal(eth.get('ETH'));
      const sol = new CryptoRpc({ ...offlineConfigs.SOL, tokens: { USDC: { type: 'SPL' } } });
      expect(sol.get('USDC')).to.be.instanceOf(SolRpc);
      expect(sol.has('USDC')).to.equal(true);
    });

    it('hands out instances of the classes the deep paths export', async function() {
      const { CryptoRpc } = await importEsm(PKG);
      const { EthRpc } = await importEsm(`${PKG}/lib/eth/EthRpc`);
      const { SolRpc } = await importEsm(`${PKG}/lib/sol/SolRpc`);
      const { XrpRpc } = await importEsm(`${PKG}/lib/xrp/XrpRpc.js`);
      expect(new CryptoRpc(offlineConfigs.ETH).get()).to.be.instanceOf(EthRpc);
      expect(new CryptoRpc(offlineConfigs.SOL).get()).to.be.instanceOf(SolRpc);
      expect(new CryptoRpc(offlineConfigs.XRP).get()).to.be.instanceOf(XrpRpc);
    });
  });

  describe('CommonJS consumer', function() {
    it('serves CryptoRpc and utils from the root', function() {
      const { CryptoRpc, utils } = requireCjs(PKG);
      expect(CryptoRpc).to.be.a('function');
      expect(utils.toBI).to.be.a('function');
    });

    for (const [subpath, exportName] of Object.entries(deepPaths)) {
      it(`serves ${subpath} with and without .js`, function() {
        const bare = requireCjs(`${PKG}/${subpath}`);
        expect(bare[exportName], exportName).to.exist;
        expect(requireCjs(`${PKG}/${subpath}.js`)).to.equal(bare);
        expect(require.resolve(`${PKG}/${subpath}.js`)).to.equal(require.resolve(`${PKG}/${subpath}`));
        expect(require.resolve(`${PKG}/${subpath}`)).to.equal(path.join(packageRoot, 'ts_build', `${subpath}.js`));
      });
    }

    it('constructs a client and returns it from get()', function() {
      const { CryptoRpc } = requireCjs(PKG);
      const rpc = new CryptoRpc(offlineConfigs.BTC);
      expect(rpc.get()).to.equal(rpc.get('BTC'));
      expect(rpc.get().rpc).to.include({ port: 8332, user: 'user', pass: 'pass' });
    });
  });

  describe('one module instance for both module systems', function() {
    it('gives require() and import() the same CryptoRpc', async function() {
      const viaRequire = requireCjs(PKG);
      const viaImport = await importEsm(PKG);
      expect(viaImport.CryptoRpc).to.equal(viaRequire.CryptoRpc);
      expect(viaImport.utils).to.equal(viaRequire.utils);
      expect(viaImport.default).to.equal(viaRequire);
    });

    it('gives require() and import() the same deep-path classes', async function() {
      for (const [subpath, exportName] of Object.entries(deepPaths)) {
        const viaRequire = requireCjs(`${PKG}/${subpath}`);
        const viaImport = await importEsm(`${PKG}/${subpath}`);
        expect(viaImport[exportName], subpath).to.equal(viaRequire[exportName]);
      }
    });

    it('so a client built in one system is recognised by the other', async function() {
      const { CryptoRpc } = requireCjs(PKG);
      const { XrpRpc } = await importEsm(`${PKG}/lib/xrp/XrpRpc`);
      expect(new CryptoRpc(offlineConfigs.XRP).get()).to.be.instanceOf(XrpRpc);
    });
  });

  describe('exports encapsulation', function() {
    const rejectionCode = async (specifier: string): Promise<string> => {
      try {
        await importEsm(specifier);
      } catch (err: any) {
        return err.code;
      }
      throw new Error(`${specifier} was importable`);
    };

    it('does not expose the build directory', async function() {
      expect(await rejectionCode(`${PKG}/ts_build/index.js`)).to.equal('ERR_PACKAGE_PATH_NOT_EXPORTED');
      expect(await rejectionCode(`${PKG}/ts_build/lib/xrp/XrpRpc.js`)).to.equal('ERR_PACKAGE_PATH_NOT_EXPORTED');
      expect(() => requireCjs(`${PKG}/ts_build/index.js`)).to.throw().with.property('code', 'ERR_PACKAGE_PATH_NOT_EXPORTED');
    });

    it('does not expose the TypeScript sources', async function() {
      // index.ts matches no export pattern; lib/*.ts matches ./lib/* but maps to a file that does not exist
      expect(await rejectionCode(`${PKG}/index.ts`)).to.equal('ERR_PACKAGE_PATH_NOT_EXPORTED');
      expect(await rejectionCode(`${PKG}/lib/xrp/XrpRpc.ts`)).to.equal('ERR_MODULE_NOT_FOUND');
    });

    it('keeps the old index.js entry point, pointing at the root export', async function() {
      // The ESM package had no exports map, so consumers could reach the root as index.js
      const root = requireCjs(PKG);
      expect(requireCjs(`${PKG}/index.js`)).to.equal(root);
      expect((await importEsm(`${PKG}/index.js`)).CryptoRpc).to.equal(root.CryptoRpc);
    });

    it('exposes package.json', async function() {
      expect(requireCjs(`${PKG}/package.json`).name).to.equal(PKG);
      const specifier = `${PKG}/package.json`;
      const mod = await import(specifier, { with: { type: 'json' } });
      expect(mod.default.name).to.equal(PKG);
    });
  });

  describe('TypeScript consumers', function() {
    // tsc on the fixtures takes a few seconds, more in the Docker runner
    this.timeout(120000);

    // Compiles test/consumers/<fixture> in a scratch directory under ts_build whose node_modules holds
    // only this package, so the fixture resolves it the way an installed dependency would while the
    // package's own node_modules, further up, still supplies @types/node and the runtime dependencies.
    const typecheck = (fixture: string) => {
      const dir = fs.mkdtempSync(path.join(packageRoot, 'ts_build', `consumer-${fixture}-`));
      try {
        fs.cpSync(path.join(packageRoot, 'test', 'consumers', fixture), dir, { recursive: true });
        fs.mkdirSync(path.join(dir, 'node_modules', '@bitpay-labs'), { recursive: true });
        fs.symlinkSync(packageRoot, path.join(dir, 'node_modules', '@bitpay-labs', 'crypto-rpc'), 'dir');
        execFileSync(process.execPath, [require.resolve('typescript/bin/tsc'), '-p', dir], { encoding: 'utf8', stdio: 'pipe' });
      } catch (err: any) {
        throw new Error(`${fixture} consumer failed to typecheck:\n${err.stdout || err.message}`);
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    };

    it('typechecks an ES module consumer on nodenext resolution', function() {
      typecheck('esm');
    });

    it('typechecks a bitcore-node style CommonJS consumer on node10 resolution', function() {
      typecheck('commonjs');
    });
  });
});
