import fs from 'fs';
import readline from 'readline';
const { CryptoRpc } = require('../../crypto-rpc');

const rpcMethods = Object.getOwnPropertyNames(CryptoRpc.prototype)
  .filter(p => typeof CryptoRpc.prototype[p] === 'function' && p !== 'constructor');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  completer: (line: string) => {
    const args = [...context, ...line.split(' ')];
    let completions: string[] = [];
    let hits: string[] = [];
    if (args.length <= 1) {
      completions = [...'use list'.split(' '), ...Object.keys(config.chains)];
      hits = completions.filter(c => c.toLowerCase().startsWith(args[0].toLowerCase()));
    } else if (args.length === 2) {
      if (Object.keys(config.chains).includes(args[0].toUpperCase())) {
        completions = Object.keys(config.chains[args[0].toUpperCase()]);
        hits = completions.filter(c => c.startsWith(args[1])).map(h => `${args[0]} ${h}`)
      }
    } else if (args.length === 3) {
      const rpc = getRpc(args[0].toUpperCase(), args[1]);
      if (rpc) {
        completions = rpcMethods;
        hits = completions.filter(c => c.startsWith(args[2])).map(h => `${args[0]} ${args[1]} ${h}`);
      }
    }
    return [hits.length ? hits : completions, line];
  }
});

process.stdout.write('> ');

const path: string = process.env.BITCORE_CONFIG_PATH || '';
const config = JSON.parse(fs.readFileSync(path).toString()).bitcoreNode;

const context: string[] = [];

rl.on('line', async (line) => {
  let args = line.split(' ');
  if (args[0] === 'use') {
    for (const arg of args.slice(1)) {
      if (arg === '..') {
        context.pop();
      } else {
        context.push(arg);
      }
    }
    end();
    return;
  }
  if (args[0] === 'list') {
    console.log(Object.keys(config.chains).join(' '));
    end();
    return;
  }
  args = [...context, ...args];

  try {
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

    const rpc = getRpc(chain, network);
    console.log(await rpc[command](rpcArgs));
  } catch (e) {
    console.log(e);
  }
  end();
});

function getRpc(chain: string, network: string) {
  if (!(config && config.chains && config.chains[chain] && config.chains[chain][network]))
    return;
  const networkConfig = config.chains[chain][network];
  const rpcConfig = networkConfig.rpc || networkConfig.providers[0];

  return new CryptoRpc({
    chain,
    protocol: rpcConfig.protocol || 'http',
    host: rpcConfig.host,
    port: rpcConfig.port,
    user: rpcConfig.username,
    pass: rpcConfig.password
  }).get(chain);
}

function end() {
  rl.setPrompt(`${context.join(' ')}> `);
  rl.prompt();
}
