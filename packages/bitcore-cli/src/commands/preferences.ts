import os from 'os';
import * as prompt from '@clack/prompts';
import { Command } from 'commander';
import type { CommonArgs } from '../../types/cli';

export function command() {
  return new Command('preferences')
    .description('View and manage wallet preferences')
    .optionsGroup('Preferences Options');
}

export async function getPreferences(args: CommonArgs) {
  const { wallet } = args;
  
  const preferences = await wallet.client.getPreferences();
  
  const lines = [];
  for (const key in preferences) {
    lines.push(`${key}: ${preferences[key]}`);
  };
  prompt.note(lines.join(os.EOL), 'Wallet Preferences');
};
