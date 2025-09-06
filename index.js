/**
 * Unified Video Framework
 * Main entry point that re-exports from packages
 */

// Re-export everything from core
module.exports = require('./packages/core/dist/index.js');

// Also export specific packages
module.exports.core = require('./packages/core/dist/index.js');
module.exports.web = require('./packages/web/dist/index.js');

// Export web-specific components if available
try {
  const webExports = require('./packages/web/dist/index.js');
  Object.keys(webExports).forEach(key => {
    module.exports[key] = webExports[key];
  });
} catch (e) {
  // Web package may not be built yet
}
