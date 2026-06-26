import { makeWebdavProvider } from './webdav.js';
import { makeMemoryProvider } from './memory.js';

export function makeProvider(config) {
  switch (config.type) {
    case 'webdav': return makeWebdavProvider(config);
    case 'memory': return makeMemoryProvider(config.seed);
    default: throw new Error('unknown provider type: ' + config.type);
  }
}
