import fs from 'fs';
import repl from 'repl';
const { CryptoRpc } = require('/home/micah/dev/bitcore/packages/crypto-rpc');

const path: string = process.env.BITCORE_CONFIG_PATH || '';
const config = JSON.parse(fs.readFileSync(path).toString()).bitcoreNode;
config;

const shell = repl.start('bitcore-sh> ');
shell.defineCommand('cryptorpc', {
  async action(_args) {
    this.clearBufferedCommand();
    const args = _args.split(' ');
    const chain = args[0].toUpperCase();
    const network = args[1];
    const command = args[2];
    args.slice(0, 3);

    const rpcArgs = {};
    for (let i = 0; i < args.length; i++) {
      if (!args[i].startsWith('--'))
        continue;
      rpcArgs[args[i].slice(2)] = args[i + 1];
      args.splice(i, 2);
      i--;
    }

    const networkConfig = config.chains[chain][network];
    const rpcConfig = networkConfig.rpc || networkConfig.providers[0];

    const rpc = new CryptoRpc({
      chain,
      protocol: rpcConfig.protocol || 'http',
      host: rpcConfig.host,
      port: rpcConfig.port,
      user: rpcConfig.username,
      pass: rpcConfig.password
    }).get(chain);

    console.log(await rpc[command](rpcArgs));
    this.displayPrompt();
  }
});
