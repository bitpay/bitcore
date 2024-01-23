import { InternalStateProvider } from '../internal/internal';

export class LTCStateProvider extends InternalStateProvider {
  constructor(chain: string = 'LTC') {
    super(chain);
  }
}
