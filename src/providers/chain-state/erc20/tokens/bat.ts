import { ERC20StateProvider } from '../erc20';

export class BATStateProvider extends ERC20StateProvider {
  constructor() {
    super('BAT', '0x0d8775f648430679a709e98d2b0cb6250d2887ef');
  }
}
