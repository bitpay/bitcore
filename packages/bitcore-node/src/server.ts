import { FullClusteredWorker } from './workers/all';
import './utils/polyfills';
require('heapdump');
FullClusteredWorker();
