// Node >= 17 started attempting to resolve all dns listings by ipv6 first, these lines are required to make it check ipv4 first
import { setDefaultResultOrder } from 'dns';
setDefaultResultOrder('ipv4first');
import './utils/polyfills';
import { FullClusteredWorker } from './workers/all';
require('heapdump');
FullClusteredWorker();
