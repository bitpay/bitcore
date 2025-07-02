import * as prompt from '@clack/prompts';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { ICliOptions } from '../../types/cli';
import { UserCancelled } from '../errors';
import { getPassword } from '../prompts';
import { Wallet } from '../wallet';

export async function exportWallet(args: {
  wallet: Wallet;
  opts: ICliOptions;
}) {
  const { wallet, opts } = args;
  const replaceTilde = str => str.startsWith('~') ? str.replace('~', os.homedir()) : str;

  const filename = await prompt.text({
    message: 'Enter filename to export to:',
    initialValue: `~/${wallet.name}-export.json`,
    validate: (value) => {
      value = value.trim();
      if (!value) return 'Filename is required';
      value = replaceTilde(value);

      try {
        let _path = '';
        for (const part of value.split('/').slice(0, -1)) {
          _path = path.join(_path, part);
          if (fs.existsSync(_path)) {
            fs.accessSync(_path, fs.constants.W_OK);
          } else {
            break; // stop at the first non-existing directory
          }
        }
      } catch (err) {
        return 'Cannot write to the specified file path: ' + err.message;
      }
      return; // valid value
    }
  });
  if (prompt.isCancel(filename)) {
    throw new UserCancelled();
  }

  const exportPassword = await getPassword('Import/export password:', { hidden: false, minLength: 6 });

  await wallet.export({
    filename: replaceTilde(filename),
    exportPassword
  });
  
  prompt.log.success('Exported to ' + filename);
};
