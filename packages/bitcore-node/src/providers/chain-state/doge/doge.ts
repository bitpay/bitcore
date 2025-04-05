import { InternalStateProvider } from '../internal/internal';

export class DOGEStateProvider extends InternalStateProvider {
  constructor(chain: string = 'DOGE') {
    super(chain);
  }
}
