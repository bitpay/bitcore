export interface TokenInfo {
  coin: string;
  blockCreated?: number;
  circulatingSupply?: number;
  containsBaton: true;
  decimals: number;
  documentHash?: string;
  documentUri: string;
  id: string;
  initialTokenQty: number;
  name: string;
  symbol: string;
  timestamp: string;
  timestamp_unix?: number;
  totalBurned: number;
  totalMinted: number;
  versionType: number;
}

export interface TokenItem {
  tokenId: string;
  tokenInfo: TokenInfo;
  amountToken: number;
  utxoToken: any;
}
