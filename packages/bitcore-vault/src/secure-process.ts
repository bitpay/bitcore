/** ---------- Child process runtime ------------- */
// Create RSA keypair

import { VaultWallet } from './VaultWallet';

// Set up listeners

const wallets = new Map<string, { wallet: VaultWallet, passphrase: Buffer | undefined }>(); // keys are wallet names