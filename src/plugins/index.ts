// Plugin module exports

export * from './types.js';
export * from './base.js';
export * from './plugins.js';
export * from './email-security.js';

// Re-export native plugin instances
export { pipedrivePlugin } from './pipedrive/index.js';
export { googlePlugin } from './google/index.js';
export { microsoftPlugin } from './microsoft/index.js';

// Plugin instance getter
import { googlePlugin } from './google/index.js';
import { microsoftPlugin } from './microsoft/index.js';
import { pipedrivePlugin } from './pipedrive/index.js';

export function getPluginInstance(name: string) {
  switch (name) {
    case 'google':
      return googlePlugin;
    case 'microsoft':
      return microsoftPlugin;
    case 'pipedrive':
      return pipedrivePlugin;
    default:
      return undefined;
  }
}
