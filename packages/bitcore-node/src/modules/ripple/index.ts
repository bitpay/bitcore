import { EventEmitter } from 'events';
import { BaseModule } from '..';
import { RippleStateProvider } from './api/csp';
import { RippleEventAdapter } from './api/event-adapter';
import { XrpRoutes } from './api/xrp-routes';
import { XrpP2pWorker } from './p2p';
import { XrpVerificationPeer } from './p2p/verification';

export default class XRPModule extends BaseModule {
  static startMonitor: EventEmitter;
  static endMonitor: EventEmitter;
  constructor(services: BaseModule['bitcoreServices']) {
    super(services);
    services.CSP.registerService('XRP', new RippleStateProvider());
    services.Api.app.use(XrpRoutes);
    services.P2P.register('XRP', XrpP2pWorker);
    services.Verification.register('XRP', XrpVerificationPeer);

    if (!XRPModule.startMonitor) {
      const adapter = new RippleEventAdapter(services);
      XRPModule.startMonitor = services.Event.events.on('start', async () => {
        await adapter.start();
      });
      XRPModule.endMonitor = services.Event.events.on('stop', async () => {
        await adapter.stop();
      });
    }
  }
}
