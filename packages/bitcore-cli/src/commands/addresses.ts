import os from 'os';
import * as prompt from '@clack/prompts';
import { Command } from 'commander';
import { Utils } from '../utils';
import type { CommonArgs } from '../../types/cli';

export function command() {
  return new Command('addresses')
    .description('List wallet addresses')
    .optionsGroup('Addresses Options')
    .option('--page <page>', 'Page number to display', '1');
}

export async function getAddresses(args: CommonArgs<{ pageSize?: number; page?: number }>) {
  const { wallet, opts } = args;
  const { pageSize } = opts;

  await Utils.paginate(async (page, _viewAction) => {
    const addresses = await wallet.client.getMainAddresses({
      // doNotVerify: true,
      limit: pageSize,
      skip: (page - 1) * pageSize
    });

    const lines = [];
    for (const a of addresses) {
      lines.push(`${a.address} (${a.path})`);
    }

    prompt.note(lines.join(os.EOL), `Addresses (Page ${page})`);

    if (opts.command) {
      return { result: [] }; // Don't wait for user input in command mode
    }
    return { result: addresses };
  }, { pageSize, initialPage: opts.page, exitOn1Page: !!opts.command });
};
