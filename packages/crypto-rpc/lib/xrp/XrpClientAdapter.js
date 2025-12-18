import xrpl from 'xrpl';

// Array elements should be lower-case
const SUPPORTED_TRANSACTION_TYPES = new Set(['payment']);
// https://xrpl.org/docs/references/protocol/transactions/transaction-results
const SUPPORTED_TRANSACTION_RESULT_CODES = {
  tes: {
    SUCCESS: 'tesSUCCESS'
  }
};

/**
 * This adapter is used to adapt the new XRP client provided by the xrpl v2 dependency
 * so that it will behave like the old XRP client provided by ripple-lib v1
 * 
 * Migration guide: https://xrpl.org/docs/references/xrpljs2-migration-guide
 * ripple-lib ref: https://github.com/XRPLF/xrpl.js/blob/1.x/docs/index.md
 */
export class XrpClientAdapter extends xrpl.Client {
  async getServerInfo() {
    return await this.request({
      id: 1,
      command: 'server_info'
    });
  }

  async getLedger({ ledgerVersion }) {
    return await this.request({
      command: 'ledger',
      ledger_index: ledgerVersion
    });
  }

  /**
     * Retrieves transactions based on the provided parameters.
     *
     * @param {string} acceptanceAddress - The address of the account to get transactions for.
     * @param {Object} options - The options for retrieving transactions.
     * @param {number} [options.minLedgerVersion] - Return only transactions in this ledger version or higher.
     * @param {number} [options.maxLedgerVersion] - Return only transactions in this ledger version or lower.
     * @param {Array<string>} [options.types] - Only return transactions of the specified valid Transaction Types (see SUPPORTED_TRANSACTION_TYPES).
     * @param {boolean} [options.initiated] - If true, return only transactions initiated by the account specified by acceptanceAddress. If false, return only transactions NOT initiated by the account specified by acceptanceAddress.
     * @param {boolean} [options.includeRawTransactions] - Include raw transaction data. For advanced users; exercise caution when interpreting this data.
     * @param {boolean} [options.excludeFailures] - If true, the result omits transactions that did not succeed.
     * @returns {Promise<Array>} A promise that resolves to an array of transactions.
     * 
     * @throws {Error} If 'includeRawTransactions' is set to false.
     * @throws {Error} If 'types' is included but not an array.
     * @throws {Error} If 'types' is included but empty.
     * @throws {Error} If 'types' includes invalid transaction types.
     * @throws {Error} If the XRPL client request does not return the expected form.
     */
  async getTransactions(acceptanceAddress, {
    minLedgerVersion,
    maxLedgerVersion,
    types,
    initiated,
    includeRawTransactions,
    excludeFailures
  }) {
    /**
     * Behavior defaults to 'true', but this error is to document that 'includeRawTransactions: false' is NOT supported
     * Truthiness is not sufficient for this check - it must explicitly be an equality check, & strict equality is prefered
     */
    if (includeRawTransactions === false) {
      throw new Error('"includeRawTransactions: false" not supported');
    }

    /**
     * Filtering constants with defaults
     */
    let TYPES = SUPPORTED_TRANSACTION_TYPES;
    if (types) {
      if (!Array.isArray(types)) throw new Error('If types is included, it should be a string array of supported types. See documentation for usage.');
      if (types.length === 0) throw new Error('If types is included, it should include at least one supported type');

      const validTypes = new Set();
      const invalidTypes = [];
      for (const type of types) {
        const lowercaseType = type.toLowerCase();
        if (SUPPORTED_TRANSACTION_TYPES.has(lowercaseType)) {
          validTypes.add(lowercaseType);
        } else {
          invalidTypes.push(type);
        }
      }

      if (invalidTypes.length > 0) throw new Error(`Invalid types included: ${invalidTypes.join(', ')}`);

      TYPES = validTypes;
    }

    // Boolean option checks must be checked against type for existence instead of using fallback assignment
    const INITIATED = typeof initiated === 'boolean' ? initiated : false;
    const EXCLUDE_FAILURES = typeof excludeFailures === 'boolean' ? excludeFailures : true;
    const INCLUDE_RAW_TRANSACTIONS = typeof includeRawTransactions === 'boolean' ? includeRawTransactions : true;

    const { result } = await this.request({
      command: 'account_tx',
      account: acceptanceAddress,
      ledger_index_min: minLedgerVersion,
      ledger_index_max: maxLedgerVersion
    });

    if (!(result && Array.isArray(result.transactions))) {
      throw new Error('xrpl client request did not return expected form');
    }

    const filteredTransactions = result.transactions.filter(({ meta, tx }) => {
      const { Account: initiatingAccount, TransactionType } = tx;

      if (!TYPES.has(TransactionType.toLowerCase())) return false;

      const isTxInitiatedByAcceptanceAddress = initiatingAccount === acceptanceAddress;
      /**
       * INITIATED
       * If true, return only transactions initiated by the account specified by acceptanceAddress.
       * If false, return only transactions NOT initiated by account specified by acceptanceAddress
       * 
       * Logical XOR
       */
      if (INITIATED !== isTxInitiatedByAcceptanceAddress) return false;

      if (EXCLUDE_FAILURES && meta.TransactionResult !== SUPPORTED_TRANSACTION_RESULT_CODES.tes.SUCCESS) return false;

      /**
       * If type in types AND tx initiator matches flag AND if excludeFailures, only include successes
       */
      return true;
    });

    // Only 'INCLUDE_RAW_TRANSACTIONS: true' is supported - this case is here for future expansion
    if (!INCLUDE_RAW_TRANSACTIONS) {
      return filteredTransactions;
    }

    return filteredTransactions.map(({ meta, tx, validated }) => {
      // ! NOTE ! The raw transaction is missing the 'DeliverMax' property & adds 'LastLedgerSequence' property
      const mappedRawTransaction = {
        ...tx,
        meta,
        validated
      };

      // Only rawTransaction used - other transaction properties excluded for simplicity. May be added as required.
      return {
        rawTransaction: JSON.stringify(mappedRawTransaction)
      };
    });
  }
}

// Find examples of response at https://xrpl.org/docs/references/http-websocket-apis/public-api-methods/account-methods/account_tx