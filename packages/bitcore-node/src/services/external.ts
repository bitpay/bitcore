// import * as os from 'os';
// import logger from '../logger';
// import { BaseBlock } from '../models/baseBlock';
// import { StateStorage } from '../models/state';
// import { wait } from '../utils/wait';
// import { Config, ConfigService } from './config';
// import { IBlock } from '../types/Block';
import { 
  // BaseP2PWorker, 
  P2pManager 
} from './p2p';

export class ExternalSyncManager extends P2pManager{

}

// export class BaseESWorker<T extends IBlock = IBlock > extends BaseP2PWorker { 

// }

export const ES = new ExternalSyncManager();