export interface CreateWalletArgs {
  walletName: string;
  opts: {
    dir: string;
    host: string;
    verbose: boolean;
    mnemonic?: string;
    isMultiParty?: boolean;
  };
}