import { FullClusteredWorker } from './workers/full';
import './utils/polyfills';
require('heapdump');
FullClusteredWorker();
