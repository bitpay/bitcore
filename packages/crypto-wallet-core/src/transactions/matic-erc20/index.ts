import Web3 from 'web3';
import { AbiItem } from 'web3-utils';
import { ERC20Abi, MULTISENDAbi } from '../erc20/abi';
import { ERC20TxProvider } from '../erc20/index';
const { toBN } = Web3.utils;

export class MATICERC20TxProvider extends ERC20TxProvider {}
