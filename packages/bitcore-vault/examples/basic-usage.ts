#!/usr/bin/env node

/**
 * Basic usage example for bitcore-secret-vault
 * Demonstrates secure credential storage and retrieval
 */

import { SecureVault } from '../src/index';

async function main() {
  // Create a new secure vault instance
  const vault = new SecureVault({
    maxCredentials: 50,
    processTimeout: 30000,
    enableSecureHeap: true,
    secureHeapSize: 2 * 1024 * 1024 // 2MB secure heap
  });

  try {
    console.log('Initializing secure vault...');
    await vault.initialize();
    console.log('✓ Vault initialized successfully');

    // Store some sensitive credentials
    console.log('\nStoring credentials...');
    
    const privateKeyResult = await vault.storeCredential({
      id: 'bitcoin-wallet-key',
      type: 'private_key',
      data: 'L1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12',
      metadata: {
        currency: 'BTC',
        wallet: 'main-wallet',
        created: new Date().toISOString()
      }
    });

    if (privateKeyResult.success) {
      console.log('✓ Private key stored:', privateKeyResult.data);
    } else {
      console.error('✗ Failed to store private key:', privateKeyResult.error);
    }

    const passwordResult = await vault.storeCredential({
      id: 'api-password',
      type: 'password',
      data: 'super-secret-password-123!',
      metadata: {
        service: 'bitcore-api',
        username: 'admin'
      },
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // Expires in 24 hours
    });

    if (passwordResult.success) {
      console.log('✓ Password stored:', passwordResult.data);
    } else {
      console.error('✗ Failed to store password:', passwordResult.error);
    }

    // List all stored credentials
    console.log('\nListing all credentials...');
    const listResult = await vault.listCredentials();
    if (listResult.success) {
      console.log('✓ Stored credentials:', listResult.data);
    }

    // Retrieve a specific credential
    console.log('\nRetrieving private key...');
    const retrieveResult = await vault.retrieveCredential('bitcoin-wallet-key');
    if (retrieveResult.success && retrieveResult.data) {
      console.log('✓ Retrieved credential:');
      console.log('  ID:', retrieveResult.data.id);
      console.log('  Type:', retrieveResult.data.type);
      console.log('  Data:', '***REDACTED***'); // Don't log sensitive data
      console.log('  Metadata:', retrieveResult.data.metadata);
      console.log('  Created:', retrieveResult.data.createdAt);
    } else {
      console.error('✗ Failed to retrieve credential:', retrieveResult.error);
    }

    // Get process state information
    console.log('\nProcess state:');
    const state = await vault.getProcessState();
    if (state) {
      console.log('  PID:', state.pid);
      console.log('  Alive:', state.isAlive);
      console.log('  Memory usage:', Math.round(state.memoryUsage.heapUsed / 1024 / 1024), 'MB');
      console.log('  Start time:', state.startTime);
    }

    // Demonstrate event handling
    vault.on('credentialStored', (id) => {
      console.log(`📥 Credential stored: ${id}`);
    });

    vault.on('credentialRetrieved', (id) => {
      console.log(`📤 Credential retrieved: ${id}`);
    });

    vault.on('error', (error) => {
      console.error('🚨 Vault error:', error);
    });

    // Store another credential to trigger events
    console.log('\nStoring another credential to demonstrate events...');
    await vault.storeCredential({
      id: 'session-token',
      type: 'token',
      data: 'jwt-token-here',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000) // Expires in 1 hour
    });

    // Clean up - delete a credential
    console.log('\nDeleting password credential...');
    const deleteResult = await vault.deleteCredential('api-password');
    if (deleteResult.success) {
      console.log('✓ Credential deleted');
    }

    // Final list
    const finalList = await vault.listCredentials();
    console.log('\nFinal credential list:', finalList.data);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    // Always clean up
    console.log('\nShutting down vault...');
    await vault.shutdown();
    console.log('✓ Vault shutdown complete');
  }
}

// Handle process termination gracefully
process.on('SIGINT', async () => {
  console.log('\n🛑 Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

// Run the example
main().catch(console.error); 