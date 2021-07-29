export interface DonationStorage {
  txidDonation: string;
  amount: number;
  isGiven: boolean;
  walletId: string;
  receiveLotusAddress: string;
  txidGiveLotus?: string;
  addressDonation: string;
  createdOn: number;
}

export interface DonationInfo {
  remaining?: number;
  minMoneydonation?: number;
  receiveAmountLotus?: number;
  donationToAddresses?: CoinDonationToAddress[];
  donationCoin?: string;
}

export interface CoinDonationToAddress {
  coin: string;
  address: string;
  network: string;
}
