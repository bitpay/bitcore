import readline from 'readline';
import config from './config';
import RPC from './rpc';

// all the commands prepended by the use command
const context: string[] = [];
let exiting = false;

// complete the chain, network, rpcCommand, and paramers
const completer = (line: string) => {
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
    const rpc = RPC.get(args[0].toUpperCase(), args[1]);
    if (rpc) {
      completions.push(...RPC.methods);
      hits = completions.filter(c => c.startsWith(args[2]));
    }
  } else if (args.length === 4) {
    completions.push(...RPC.getMethodParams(args[0], args[1], args[2]));
    hits = completions.filter(c => c.startsWith(args[3]));
  }
  return [hits.length ? hits : completions, args[args.length - 1]];
};

// repl environment
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  completer
});
nextCommand();

// handle all user commands
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
  } else if (args[0] === 'exit') {
    process.exit(0);
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

    const rpc = RPC.get(chain, network);
    if (rpc)
      console.log(await rpc[command](rpcArgs));
  } catch (e) {
    console.log(e);
  }
  nextCommand();
});

rl.on('SIGINT', () => {
  if (exiting) {
    process.exit(0);
  }
  rl.setPrompt(`${context.join(' ')}> \n(To exit, press Ctrl+C again or Ctrl+D or type exit)\n${context.join(' ')}> `);
  rl.prompt();
  exiting = true;
});

function nextCommand() {
  rl.setPrompt(`${context.join(' ')}> `);
  rl.prompt();
  exiting = false;
}
