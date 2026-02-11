// Plugin module exports

export * from './types.js';
export * from './base.js';
export * from './plugins.js';

// Re-export native plugin instances
export { pipedrivePlugin } from './pipedrive/index.js';
export { googlePlugin } from './google/index.js';
export { microsoftPlugin } from './microsoft/index.js';
