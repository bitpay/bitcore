import * as prompt from '@clack/prompts';
import os from 'os';
import { ICliOptions } from '../../types/cli';
import { Wallet } from '../wallet';

export async function getPreferences(args: {
  wallet: Wallet;
  opts: ICliOptions;
}) {
  const { wallet, opts } = args;
  const preferences = await wallet.client.getPreferences();
  
  const lines = [];
  for (const key in preferences) {
    lines.push(`${key}: ${preferences[key]}`);
  };
  prompt.note(lines.join(os.EOL), 'Wallet Preferences');

};
