import { BaseModule } from '..';
import { RippleStateProvider } from './api/csp';
import { RippleEventAdapter } from './api/event-adapter';
import { XrpRoutes } from './api/xrp-routes';
import { XrpP2pWorker } from './p2p';
import { XrpVerificationPeer } from './p2p/verification';

export default class XRPModule extends BaseModule {
  constructor(services: BaseModule['bitcoreServices']) {
    super(services);
    services.CSP.registerService('XRP', new RippleStateProvider());
    services.Api.app.use(XrpRoutes);
    services.P2P.register('XRP', XrpP2pWorker);
    services.Verification.register('XRP', XrpVerificationPeer);
    let adapter = new RippleEventAdapter(services);

    services.Event.events.on('start', async () => {
      await adapter.start();
    });

    services.Event.events.on('stop', async () => {
      await adapter.stop();
    });
  }
}
