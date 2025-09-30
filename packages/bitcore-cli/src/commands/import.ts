import * as prompt from '@clack/prompts';
import fs from 'fs';
import os from 'os';
import type { CommonArgs } from '../../types/cli';
import { UserCancelled } from '../errors';
import { getPassword } from '../prompts';

export async function importWallet(args: CommonArgs) {
  const { wallet, opts } = args;
  const replaceTilde = str => str.startsWith('~') ? str.replace('~', os.homedir()) : str;
  
  const filename = await prompt.text({
    message: 'Enter filename to import:',
    initialValue: `~/${wallet.name}-export.json`,
    validate: (value) => {
      value = value.trim();
      if (!value) return 'Filename is required';
      value = replaceTilde(value);
      if (!fs.existsSync(value)) {
        return 'File does not exist: ' + value;
      }
      return; // valid value
    }
  });
  if (prompt.isCancel(filename)) {
    throw new UserCancelled();
  }

  const importPassword = await getPassword('Import/export password:', { hidden: true });
  
  await wallet.import({
    filename: replaceTilde(filename),
    importPassword
  });

  prompt.log.success(`Wallet ${wallet.name} imported successfully!`);
};