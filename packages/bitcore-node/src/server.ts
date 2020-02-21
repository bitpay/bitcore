import './utils/polyfills';
import { FullClusteredWorker } from './workers/all';
require('heapdump');
FullClusteredWorker();
