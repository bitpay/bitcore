import Web3 from 'web3';
import { AbiItem } from 'web3-utils';
import { ETHTxProvider } from '../eth';
import { MultisigAbi } from './abi';

export class ETHMULTISIGTxProvider extends ETHTxProvider {
  getMultisigContract(multisigContractAddress: string) {
    const web3 = new Web3();
    const contract = new web3.eth.Contract(MultisigAbi as AbiItem[], multisigContractAddress);
    return contract;
  }

  create(params: {
    recipients: Array<{ address: string; amount: string }>;
    nonce: number;
    gasPrice: number;
    data: string;
    gasLimit: number;
    multisigContractAddress: string;
    network: string;
    chainId?: number;
  }) {
    const { multisigContractAddress } = params;
    const recipients = [{ address: multisigContractAddress, amount: '0' }];
    const newParams = { ...params, recipients };
    return super.create(newParams);
  }

  instantiateEncodeData(params: {
    addresses: Array<string>;
    requiredConfirmations: number;
    multisigGnosisContractAddress: string;
    dailyLimit: number;
  }) {
    const { addresses, requiredConfirmations, multisigGnosisContractAddress, dailyLimit } = params;
    let requiredConfirmationsStr = Number(requiredConfirmations).toLocaleString('en', { useGrouping: false });
    let dailyLimitStr = Number(dailyLimit).toLocaleString('en', { useGrouping: false });
    const data = this.getMultisigContract(multisigGnosisContractAddress)
      .methods.create(addresses, requiredConfirmationsStr, dailyLimitStr)
      .encodeABI();
    return data;
  }

  addOwnerEncodeData(params: { newOwnerAddress: string; multisigContractAddress: string }) {
    const { multisigContractAddress, newOwnerAddress } = params;
    const data = this.getMultisigContract(multisigContractAddress)
      .methods.addOwner(newOwnerAddress)
      .encodeABI();
    return this.submitEncodeData({
      recipients: [
        {
          address: multisigContractAddress,
          amount: '0'
        }
      ],
      multisigContractAddress,
      data
    });
  }

  removeOwnerEncodeData(params: { newOwnerAddress: string; multisigContractAddress: string }) {
    const { multisigContractAddress, newOwnerAddress } = params;
    const data = this.getMultisigContract(multisigContractAddress)
      .methods.removeOwner(newOwnerAddress)
      .encodeABI();
    return this.submitEncodeData({
      recipients: [
        {
          address: multisigContractAddress,
          amount: '0'
        }
      ],
      multisigContractAddress,
      data
    });
  }

  replaceOwnerEncodeData(params: {
    oldOwnerAddress: string;
    newOwnerAddress: string;
    multisigContractAddress: string;
  }) {
    const { multisigContractAddress, newOwnerAddress, oldOwnerAddress } = params;
    const data = this.getMultisigContract(multisigContractAddress)
      .methods.removeOwner(oldOwnerAddress, newOwnerAddress)
      .encodeABI();
    return this.submitEncodeData({
      recipients: [
        {
          address: multisigContractAddress,
          amount: '0'
        }
      ],
      multisigContractAddress,
      data
    });
  }

  changeRequirementEncodedData(params: { requiredConfirmations: number; multisigContractAddress: string }) {
    const { requiredConfirmations, multisigContractAddress } = params;
    let data;
    let requiredConfirmationsStr = Number(requiredConfirmations).toLocaleString('en', { useGrouping: false });
    data = this.getMultisigContract(multisigContractAddress)
      .methods.changeRequirement(requiredConfirmationsStr)
      .encodeABI();
    return this.submitEncodeData({
      recipients: [
        {
          address: multisigContractAddress,
          amount: '0'
        }
      ],
      multisigContractAddress,
      data
    });
  }

  changeDailyLimitEncodedData(params: { requiredConfirmations: number; multisigContractAddress: string }) {
    const { requiredConfirmations, multisigContractAddress } = params;
    let data;
    let requiredConfirmationsStr = Number(requiredConfirmations).toLocaleString('en', { useGrouping: false });
    data = this.getMultisigContract(multisigContractAddress)
      .methods.changeDailyLimit(requiredConfirmationsStr)
      .encodeABI();
    return this.submitEncodeData({
      recipients: [
        {
          address: multisigContractAddress,
          amount: '0'
        }
      ],
      multisigContractAddress,
      data
    });
  }

  confirmTransactionEncodeData(params: { multisigContractAddress: string; transactionId: number }) {
    const { multisigContractAddress, transactionId } = params;
    const data = this.getMultisigContract(multisigContractAddress)
      .methods.confirmTransaction(transactionId)
      .encodeABI();
    return data;
  }

  revokeConfirmationEncodeData(params: { multisigContractAddress: string; transactionId: number }) {
    const { multisigContractAddress, transactionId } = params;
    const data = this.getMultisigContract(multisigContractAddress)
      .methods.revokeConfirmation(transactionId)
      .encodeABI();
    return data;
  }

  executeTransactionEncodeData(params: { multisigContractAddress: string; transactionId: number }) {
    const { multisigContractAddress, transactionId } = params;
    const data = this.getMultisigContract(multisigContractAddress)
      .methods.executeTransaction(transactionId)
      .encodeABI();
    return data;
  }

  // data: It is used to invoke functionalities of a contract and can be left empty ('0x') or bytes(0) for regular value transfers.
  // address: It is used o invoke functionalities of a contract needs to be the address of the Smart Contract whose method you want to invoke.
  submitEncodeData(params: {
    recipients: Array<{ address: string; amount: string }>;
    multisigContractAddress: string;
    data: string;
  }) {
    const { multisigContractAddress, data } = params;
    const [{ address, amount }] = params.recipients;
    const amountStr = Number(amount).toLocaleString('en', { useGrouping: false });
    const contract = this.getMultisigContract(multisigContractAddress);
    return contract.methods.submitTransaction(address, amountStr, data).encodeABI();
  }
}
