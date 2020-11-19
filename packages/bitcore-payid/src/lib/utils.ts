/**
 * Determines if the environment is a browser environment (as opposed to Node.js)
 */
export const inBrowser = () => {
  return typeof Window !== 'undefined' && globalThis instanceof Window;
};
