export const inBrowser = () => {
  return typeof Window !== 'undefined' && globalThis instanceof Window;
};
