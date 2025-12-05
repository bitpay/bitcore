import os from 'os';
import * as prompt from '@clack/prompts';
import type { CommonArgs } from '../../types/cli';

export function command(args: CommonArgs) {
  const { program } = args;
  program
    .description('View and manage wallet preferences')
    .usage('<walletName> --command preferences [options]')
    .optionsGroup('Preferences Options')
    .parse(process.argv);

  const opts = program.opts();
  if (opts.help) {
    program.help();
  }

  return opts;
}

export async function getPreferences(args: CommonArgs) {
  const { wallet, opts } = args;
  if (opts.command) {
    Object.assign(opts, command(args));
  }
  
  const preferences = await wallet.client.getPreferences();
  
  const lines = [];
  for (const key in preferences) {
    lines.push(`${key}: ${preferences[key]}`);
  };
  prompt.note(lines.join(os.EOL), 'Wallet Preferences');
};
