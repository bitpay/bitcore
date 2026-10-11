import { getPassword } from '../prompts';
import type { CommonArgs } from '../../types/cli';


export async function changePassword(args: CommonArgs) {
  const { wallet } = args;
  
  const currentPassword = await wallet.getWalletPassword();
  const newPassword = await getPassword('Enter new password:', { hidden: false, minLength: 6, confirm: true });


  await wallet.updatePassword(currentPassword, newPassword);
};
