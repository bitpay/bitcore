export interface TokenInfo {
  id: string;
  symbol: string;
  name: string;
  coin: string;
  decimals: number;
  documentHash?: string;
  documentUri: string;
}

export interface TokenItem {
  tokenId: string;
  tokenInfo: TokenInfo;
  amountToken: number;
  utxoToken: any;
}
