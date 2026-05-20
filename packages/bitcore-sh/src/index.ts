import readline from 'readline';
import config from './config';
const { CryptoRpc } = require('../../crypto-rpc');

const rpcMethods = Object.getOwnPropertyNames(CryptoRpc.prototype)
  .filter(p => typeof CryptoRpc.prototype[p] === 'function' && p !== 'constructor');
const context: string[] = [];

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  completer: (line: string) => {
    let args = [...context, ...line.split(' ')];
    if (args.includes('use'))
      args = args.filter(arg => arg !== 'use');
    const completions: string[] = line.includes(' ') ? [] : ['use'];
    let hits: string[] = [];
    if (args.length <= 1) {
      completions.push(...Object.keys(config));
      hits = completions.filter(c => c.toLowerCase().startsWith(args[0].toLowerCase()));
    } else if (args.length === 2) {
      if (Object.keys(config).includes(args[0].toUpperCase())) {
        completions.push(...Object.keys(config[args[0].toUpperCase()]));
        hits = completions.filter(c => c.startsWith(args[1]));
      }
    } else if (args.length === 3) {
      const rpc = getRpc(args[0].toUpperCase(), args[1]);
      if (rpc) {
        completions.push(...rpcMethods);
        hits = completions.filter(c => c.startsWith(args[2]));
      }
    } else if (args.length === 4) {
      const rpc = getRpc(args[0].toUpperCase(), args[1]);
      if (rpc) {
        completions.push(getParams(rpc[args[2]]));
        hits = completions.filter(c => c.startsWith(args[3]));
      }
    }
    return [hits.length ? hits : completions, args[args.length - 1]];
  }
});
nextCommand();

function getParams(func) {
  const funcStr = func.toString();
  const match = funcStr.match(/\{\s*([^}]+)\s*\}/);
  if (!match) return [];

  return match[1]
    .split(',')
    .map((key: string) => key.trim())
    .map((key: string) => '--' + (key.substring(0, key.indexOf(' ')) || key))
    .filter((key: string) => key);
}


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
    nextCommand();
    return;
  }
  args = [...context, ...args];

  try {
    const chain = args[0].toUpperCase();
    const network = args[1];
    const command = args[2];
    args.splice(0, 3);

    const rpcArgs = {};
    for (let i = 0; i < args.length; i++) {
      if (!args[i].startsWith('--'))
        continue;
      rpcArgs[args[i].slice(2)] = args[i + 1];
      args.splice(i, 2);
      i--;
    }

    const rpc = getRpc(chain, network);
    if (rpc)
      console.log(await rpc[command](rpcArgs));
  } catch (e) {
    console.log(e);
  }
  nextCommand();
});

function getRpc(chain: string, network: string) {
  if (!config[chain][network])
    return;
  const rpcConfig = config[chain][network];

  return new CryptoRpc({
    chain,
    protocol: rpcConfig.protocol || 'http',
    host: rpcConfig.host,
    port: rpcConfig.port,
    user: rpcConfig.username,
    pass: rpcConfig.password
  }).get(chain);
}

function nextCommand() {
  rl.setPrompt(`${context.join(' ')}> `);
  rl.prompt();
}
