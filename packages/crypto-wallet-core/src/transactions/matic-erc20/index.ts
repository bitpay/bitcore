import Web3 from 'web3';
import { AbiItem } from 'web3-utils';
import { ERC20TxProvider } from '../erc20/index';
import { ERC20Abi, MULTISENDAbi } from '../erc20/abi';
const { toBN } = Web3.utils;

export class MATICERC20TxProvider extends ERC20TxProvider {}