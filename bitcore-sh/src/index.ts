import fs from 'fs';
import readline from 'readline'
const { CryptoRpc } = require('/home/micah/dev/bitcore/packages/crypto-rpc');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
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
  end();
});

function end() {
  process.stdout.write(`${context.join(' ')}> `);
}
