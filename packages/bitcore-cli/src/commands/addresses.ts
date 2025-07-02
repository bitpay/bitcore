import * as prompt from '@clack/prompts';
import os from 'os';
import { Utils } from '../utils';
import { Wallet } from '../wallet';
import { ICliOptions } from '../../types/cli';

export async function getAddresses(args: {
  wallet: Wallet;
  opts: ICliOptions & {
    pageSize: number;
  }
}) {
  const { wallet, opts } = args;
  const { pageSize } = opts;

  await Utils.paginate(async (page, viewAction) => {
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

    return { result: addresses };
  }, { pageSize });
};
