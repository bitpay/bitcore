import fs from 'fs';
import os from 'os';
import path from 'path';
import * as prompt from '@clack/prompts';
import { Command } from 'commander';
import { UserCancelled } from '../errors';
import { getPassword } from '../prompts';
import type { CommonArgs } from '../../types/cli';

export function command() {
  return new Command('export')
    .description('Export wallet to a file')
    .optionsGroup('Export Options')
    .option('--filename <filename>', 'Filename to export to')
    .option('--readonly', 'Export as read-only (cannot send funds)');
}

export async function exportWallet(args: CommonArgs<{ filename?: string; readonly?: boolean }>) {
  const { wallet, opts } = args;

  const replaceTilde = str => str.startsWith('~') ? str.replace('~', os.homedir()) : str;

  const readOnly = opts.readonly ?? (wallet.isReadOnly() || await prompt.confirm({
    message: 'Export as read-only (cannot send funds)?',
    initialValue: false
  }));
  if (prompt.isCancel(readOnly)) {
    throw new UserCancelled();
  }

  const filename = opts.filename || await prompt.text({
    message: 'Enter filename to export to:',
    initialValue: `~/${wallet.name}${readOnly ? '-nokey' : ''}-export.json`,
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

  const exportPassword = await getPassword('File encryption password:', { hidden: false, minLength: 6, confirm: true });

  await wallet.export({
    filename: replaceTilde(filename),
    exportPassword,
    readOnly
  });
  
  prompt.log.success('Exported to ' + filename);
};
