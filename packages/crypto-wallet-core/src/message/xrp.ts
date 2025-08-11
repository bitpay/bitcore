import BitcoreLib from 'bitcore-lib';
import { ethers } from 'ethers';
import { type Encoding, type HDKeyType, type IMessageClass, type KeyType } from '../types/message';
import { encodeBuffer } from '../utils';

import { EthMessage } from './eth';

export class XrpMessage extends EthMessage {}; // TODO