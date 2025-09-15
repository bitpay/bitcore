const validRequests = [
    'generateSecureKeypair',
    'checkSecureHeapEnabled',
    'verifyExpectedAllocation',
    'storeCredential',
    'readInCredential',
    'getDecryptedCredential',
    'listCredentials',
    'deleteCredential',
    'clearVault'
] as const;
const validChildMessageTypes = validRequests.map(request => `${request}:result`);

export {
    validRequests,
    validChildMessageTypes
}