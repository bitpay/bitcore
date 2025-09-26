import BitcoreLib from 'bitcore-lib';
import { ethers } from 'ethers';
import type { Encoding, HDKeyType, IMessageClass, KeyType } from '../types/message';
import { encodeBuffer } from '../utils';

import { EthMessage } from './eth';

export class SolMessage extends EthMessage {}; // TODO