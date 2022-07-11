import { ethers } from 'ethers';
import Web3 from 'web3';
import { ETHTxProvider } from '../eth';
const utils = require('web3-utils');
const { toBN } = Web3.utils;
export class MaticTxProvider extends ETHTxProvider {}
