import { expect } from 'chai';
import { SecureVault } from '../src/SecureVault';
import { SecureCredential } from '../src/types';

describe('SecureVault', () => {
  let vault: SecureVault;

  beforeEach(async () => {
    vault = new SecureVault({
      maxCredentials: 10,
      processTimeout: 10000,
      enableSecureHeap: true,
      secureHeapSize: 1024 * 1024
    });
  });

  afterEach(async () => {
    if (vault) {
      await vault.shutdown();
    }
  });

  describe('initialization', () => {
    it('should initialize successfully', async function() {
      this.timeout(15000); // Allow more time for child process startup
      
      await vault.initialize();
      const state = await vault.getProcessState();
      
      expect(state).to.not.be.null;
      expect(state?.isAlive).to.be.true;
    });

    it('should throw error if initialized twice', async function() {
      this.timeout(15000);
      
      await vault.initialize();
      
      try {
        await vault.initialize();
        expect.fail('Should have thrown an error');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        expect(errorMessage).to.include('already initialized');
      }
    });
  });

  describe('credential management', () => {
    beforeEach(async function() {
      this.timeout(15000);
      await vault.initialize();
    });

    it('should store and retrieve a credential', async () => {
      const credential: Omit<SecureCredential, 'createdAt'> = {
        id: 'test-key-1',
        type: 'private_key',
        data: 'sensitive-private-key-data',
        metadata: { purpose: 'testing' }
      };

      const storeResult = await vault.storeCredential(credential);
      expect(storeResult.success).to.be.true;
      expect(storeResult.data).to.equal('test-key-1');

      const retrieveResult = await vault.retrieveCredential('test-key-1');
      expect(retrieveResult.success).to.be.true;
      expect(retrieveResult.data?.id).to.equal('test-key-1');
      expect(retrieveResult.data?.type).to.equal('private_key');
      expect(retrieveResult.data?.data).to.equal('sensitive-private-key-data');
    });

    it('should list stored credentials', async () => {
      const credential1: Omit<SecureCredential, 'createdAt'> = {
        id: 'key-1',
        type: 'private_key',
        data: 'data-1'
      };

      const credential2: Omit<SecureCredential, 'createdAt'> = {
        id: 'key-2',
        type: 'password',
        data: 'data-2'
      };

      await vault.storeCredential(credential1);
      await vault.storeCredential(credential2);

      const listResult = await vault.listCredentials();
      expect(listResult.success).to.be.true;
      expect(listResult.data).to.include('key-1');
      expect(listResult.data).to.include('key-2');
    });

    it('should delete a credential', async () => {
      const credential: Omit<SecureCredential, 'createdAt'> = {
        id: 'delete-me',
        type: 'token',
        data: 'token-data'
      };

      await vault.storeCredential(credential);
      
      const deleteResult = await vault.deleteCredential('delete-me');
      expect(deleteResult.success).to.be.true;
      expect(deleteResult.data).to.be.true;

      const retrieveResult = await vault.retrieveCredential('delete-me');
      expect(retrieveResult.success).to.be.false;
      expect(retrieveResult.error).to.include('not found');
    });

    it('should clear all credentials', async () => {
      const credential: Omit<SecureCredential, 'createdAt'> = {
        id: 'clear-test',
        type: 'password',
        data: 'password-data'
      };

      await vault.storeCredential(credential);
      
      const clearResult = await vault.clearVault();
      expect(clearResult.success).to.be.true;

      const listResult = await vault.listCredentials();
      expect(listResult.success).to.be.true;
      expect(listResult.data).to.be.empty;
    });
  });
}); 