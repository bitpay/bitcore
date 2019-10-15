import { BaseModule } from '..';
import { RippleStateProvider } from './api/csp';

export default class XRPModule extends BaseModule {
  constructor(services: BaseModule['bitcoreServices']) {
    super(services);
    services.CSP.registerService('XRP', new RippleStateProvider());
  }
}
