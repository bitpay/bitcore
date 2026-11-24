// Exercise fatal shutdown in a child process without starting external services.
import sinon from 'sinon';
import * as modules from '../../src/modules';
import { Api } from '../../src/services/api';
import { Event } from '../../src/services/event';
import { P2P } from '../../src/services/p2p';
import { Storage } from '../../src/services/storage';
import { ClusteredApiWorker } from '../../src/workers/api';
import { FullClusteredWorker } from '../../src/workers/all';

// Keep the process alive until shutdown finishes, including signal delivery.
const keepAlive = setInterval(() => {}, 1000);
sinon.stub(modules, 'loadModules');
for (const [name, service] of Object.entries({ Storage, Event, P2P, Api })) {
  sinon.stub(service, 'start').resolves();
  sinon.stub(service, 'stop').callsFake(async () => {
    process.stdout.write(`stopped:${name}\n`);
    if (service === Storage) clearInterval(keepAlive);
  });
}

const start = process.argv[2] === 'api' ? ClusteredApiWorker : FullClusteredWorker;
start().then(() => {
  if (process.argv[3] === 'signal') {
    process.kill(process.pid, 'SIGTERM');
  } else {
    Promise.reject(process.argv[3] === 'null' ? null : new Error('injected rejection'));
  }
}).catch(error => {
  console.error(error);
  process.exit(1);
});
