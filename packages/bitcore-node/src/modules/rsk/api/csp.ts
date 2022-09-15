import Config from '../../../config';
import { ETHStateProvider } from '../../ethereum/api/csp';

export { EventLog } from '../../ethereum/api/csp';
export class RSKStateProvider extends ETHStateProvider {
  /*
   * Reusing ETHStateProvider class for RSK 
   * Purpose is to avoid code duplication and reduce maintenance cost
   */
  constructor(public chain: string = 'RSK') {
    super(chain);
    this.config = Config.chains[this.chain];
  }

}

export const RSK = new RSKStateProvider();

