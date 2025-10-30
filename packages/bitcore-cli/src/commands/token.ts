import * as prompt from '@clack/prompts';
import { UserCancelled } from '../errors';
import { Utils } from '../utils';
import { Wallet } from '../wallet';
import type { CommonArgs } from '../../types/cli';


export async function setToken(args: CommonArgs) {
  const { wallet } = args;

  const currencies = await Wallet.getCurrencies(wallet.network);
  function findTokenObj(value) {
    return currencies.find(c =>
      c.contractAddress?.toLowerCase() === value.toLowerCase() ||
      c.displayCode?.toLowerCase() === value.toLowerCase() ||
      c.code?.toLowerCase() === value.toLowerCase()
    );
  };

  const token = await prompt.text({
    message: 'Enter the token name or address (blank to unset):',
    placeholder: 'e.g. USDC',
    validate: (value) => {
      if (!value || findTokenObj(value)) {
        return null; // valid value
      }
      return 'No token found';
    }
  });
  if (prompt.isCancel(token)) {
    throw new UserCancelled();
  }

  const tokenObj = token ? findTokenObj(token) : null;
  if (tokenObj) {
    prompt.log.success(Utils.colorText('Session is now in token mode: ', 'green') + `${tokenObj.displayCode} - ${tokenObj.contractAddress}`);
  } else {
    prompt.log.success(Utils.colorText('Session is now in native currency mode', 'green'));
  }
  return { action: 'menu', tokenObj };
}
