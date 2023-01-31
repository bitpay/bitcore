import { setDefaultResultOrder } from 'dns';
import './utils/polyfills';
import { FullClusteredWorker } from './workers/all';
setDefaultResultOrder('ipv4first');
require('heapdump-next');
FullClusteredWorker();
