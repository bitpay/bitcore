import * as prompt from '@clack/prompts';
import { Command } from 'commander';
import type { CommonArgs } from '../../types/cli';

export function command() {
  return new Command('address')
    .description('Create a new address')
    .optionsGroup('Address Options');
}

export async function createAddress(args: CommonArgs) {
  const { wallet } = args;

  const x = await wallet.client.createAddress({});
  prompt.note(x.address, `Address (${x.path})`);
};
