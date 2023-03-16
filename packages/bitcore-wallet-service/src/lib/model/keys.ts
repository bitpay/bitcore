interface Keys {
  keyFund: string;
  keyReceive: string;
  createdOn: number;
  lastModified: number;
  hashPassword: string;
  hashRecoveryKey: string;
}

interface KeysConversion {
  keyFund: string;
  createdOn: Date;
  lastModified: Date;
  hashPassword: string;
  hashRecoveryKey: string;
}
