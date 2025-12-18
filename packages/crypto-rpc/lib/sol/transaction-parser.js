import * as SolComputeBudget from '@solana-program/compute-budget';
import * as SolMemo from '@solana-program/memo';
import * as SolSystem from '@solana-program/system';
import * as SolToken from '@solana-program/token';

const solTokenProgramAddress = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';

export const instructionKeys = {
  TRANSFER_SOL: 'transferSol',
  TRANSFER_CHECKED_TOKEN: 'transferCheckedToken',
  TRANSFER_TOKEN: 'transferToken',
  ADVANCE_NONCE_ACCOUNT: 'advanceNonceAccount',
  MEMO: 'memo',
  SET_COMPUTE_UNIT_LIMIT: 'setComputeUnitLimit',
  SET_COMPUTE_UNIT_PRICE: 'setComputeUnitPrice',
  CREATE_ASSOCIATED_TOKEN: 'createAssociatedToken',
  CREATE_ASSOCIATED_TOKEN_IDEMPOTENT: 'createAssociatedTokenIdempotent',
  RECOVER_NESTED_ASSOCIATED_TOKEN: 'recoverNestedAssociatedToken',
  UNKNOWN: 'unknownInstruction',
};

/**
 * @param {any[]} instructions 
 * @returns {Instructions}
 */
export const parseInstructions = (instructions) => {
  const parsedInstructions = {};
  for (const instruction of instructions) {
    let handledInstruction;
    try {
      if (instruction.programAddress === SolSystem.SYSTEM_PROGRAM_ADDRESS) {
        handledInstruction = parseSystemProgramInstruction(instruction);
      } else if (instruction.programAddress === SolMemo.MEMO_PROGRAM_ADDRESS) {
        handledInstruction = parseMemoProgramInstruction(instruction);
      } else if (instruction.programAddress === SolToken.ASSOCIATED_TOKEN_PROGRAM_ADDRESS) {
        handledInstruction = parseAssociatedTokenProgramInstruction(instruction);
      } else if (instruction.programAddress === solTokenProgramAddress) {
        handledInstruction = parseTokenProgramInstruction(instruction);
      } else if (instruction.programAddress === SolComputeBudget.COMPUTE_BUDGET_PROGRAM_ADDRESS) {
        handledInstruction = parseComputeBudgetProgramInstruction(instruction);
      } else {
        handledInstruction = {
          key: instructionKeys.UNKNOWN,
          value: instruction
        };
      }
    } catch (err) {
      handledInstruction = {
        key: instructionKeys.UNKNOWN,
        value: {
          ...instruction,
          error: err.message,
          programAddress: instruction.programAddress
        }
      };
    }
    
    if (!parsedInstructions[handledInstruction.key]) {
      parsedInstructions[handledInstruction.key] = [];
    }
    parsedInstructions[handledInstruction.key].push(handledInstruction.value);
  }
  return parsedInstructions;
};

const parseSystemProgramInstruction = (instruction) => {
  const identifiedInstruction = SolSystem.identifySystemInstruction(instruction);
  const parsedInstruction = {};
  if (identifiedInstruction === SolSystem.SystemInstruction.TransferSol) {
    const parsedTransferSolInstruction = SolSystem.parseTransferSolInstruction(instruction);
    const { accounts, data } = parsedTransferSolInstruction;
    const amount = Number(data.amount);
    const currency = 'SOL';
    const destination = accounts.destination.address;
    const source = accounts.source.address;
    parsedInstruction.key = instructionKeys.TRANSFER_SOL;
    parsedInstruction.value = { amount, currency, destination, source };
  } else if (identifiedInstruction === SolSystem.SystemInstruction.AdvanceNonceAccount) {
    const parsedAdvanceNonceAccountInstruction = SolSystem.parseAdvanceNonceAccountInstruction(instruction);
    const { nonceAccount, nonceAuthority } = parsedAdvanceNonceAccountInstruction.accounts;
    parsedInstruction.key = instructionKeys.ADVANCE_NONCE_ACCOUNT;
    parsedInstruction.value = {
      nonceAccount: nonceAccount.address,
      nonceAuthority: nonceAuthority.address
    };
  } else {
    parsedInstruction.key = `unparsedSystemInstruction_${identifiedInstruction}`;
    parsedInstruction.value = instruction;
  }
  return parsedInstruction;
};

const parseMemoProgramInstruction = (instruction) => {
  const parsedInstruction = {};
  const parsedMemoInstruction = SolMemo.parseAddMemoInstruction({ ...instruction }); // Only one instruction with MEMO_PROGRAM_ADDRESS
  parsedInstruction.key = instructionKeys.MEMO;
  parsedInstruction.value = parsedMemoInstruction.data;
  return parsedInstruction;
};

const parseAssociatedTokenProgramInstruction = (instruction) => {
  // Add data field if missing
  let processedInstruction = instruction;
  if (!instruction.data) {
    // Default to CreateAssociatedToken instruction (most common)
    processedInstruction = { 
      ...instruction, 
      data: new Uint8Array([SolToken.AssociatedTokenInstruction.CreateAssociatedToken]) // CreateAssociatedToken discriminator
    };
  }

  const identifiedTokenInstruction = SolToken.identifyAssociatedTokenInstruction(processedInstruction);

  if (identifiedTokenInstruction === SolToken.AssociatedTokenInstruction.CreateAssociatedToken) {
    const parsedCreateInstruction = SolToken.parseCreateAssociatedTokenInstruction(processedInstruction);
    const { accounts } = parsedCreateInstruction;

    return {
      key: instructionKeys.CREATE_ASSOCIATED_TOKEN,
      value: {
        payer: accounts.payer.address,
        associatedTokenAccount: accounts.ata.address,
        owner: accounts.owner.address,
        mint: accounts.mint.address,
        tokenProgram: accounts.tokenProgram.address
      }
    };
  } else if (identifiedTokenInstruction === SolToken.AssociatedTokenInstruction.CreateAssociatedTokenIdempotent) {
    const parsedIdempotentInstruction = SolToken.parseCreateAssociatedTokenIdempotentInstruction(processedInstruction);
    const { accounts } = parsedIdempotentInstruction;

    return {
      key: instructionKeys.CREATE_ASSOCIATED_TOKEN_IDEMPOTENT,
      value: {
        payer: accounts.payer.address,
        associatedTokenAccount: accounts.ata.address,
        owner: accounts.owner.address,
        mint: accounts.mint.address,
        tokenProgram: accounts.tokenProgram.address
      }
    };
  } else if (identifiedTokenInstruction === SolToken.AssociatedTokenInstruction.RecoverNestedAssociatedToken) {
    const parsedRecoverInstruction = SolToken.parseRecoverNestedAssociatedTokenInstruction(processedInstruction);
    const { accounts } = parsedRecoverInstruction;

    return {
      key: instructionKeys.RECOVER_NESTED_ASSOCIATED_TOKEN,
      value: {
        nestedAssociatedTokenAccount: accounts.nestedAta.address,
        nestedMint: accounts.nestedMint.address,
        destinationAssociatedTokenAccount: accounts.destinationAta.address,
        owner: accounts.owner.address,
        mint: accounts.mint.address,
        tokenProgram: accounts.tokenProgram.address
      }
    };
  } else {
    return {
      key: `unparsedAssociatedTokenInstruction_${identifiedTokenInstruction}`,
      value: instruction
    };
  }
};

const parseTokenProgramInstruction = (instruction) => {
  const parsedInstruction = {};
  const identifiedTokenInstruction = SolToken.identifyTokenInstruction(instruction);
  if (identifiedTokenInstruction === SolToken.TokenInstruction.Transfer) {
    const parsedTransferTokenInstruction = SolToken.parseTransferInstruction(instruction);
    const { accounts, data } = parsedTransferTokenInstruction;
    parsedInstruction.key = instructionKeys.TRANSFER_TOKEN;
    parsedInstruction.value = {
      authority: accounts.authority.address,
      destination: accounts.destination.address,
      source: accounts.source.address,
      amount: Number(data.amount)
    };
  } else if (identifiedTokenInstruction === SolToken.TokenInstruction.TransferChecked) {
    const parsedTransferCheckedTokenInstruction = SolToken.parseTransferCheckedInstruction(instruction);
    const { accounts, data } = parsedTransferCheckedTokenInstruction;
    parsedInstruction.key = instructionKeys.TRANSFER_CHECKED_TOKEN;
    parsedInstruction.value = {
      authority: accounts.authority.address,
      destination: accounts.destination.address,
      mint: accounts.mint.address,
      source: accounts.source.address,
      amount: Number(data.amount),
      decimals: data.decimals
    };
  } else {
    parsedInstruction.key = `unparsedTokenInstruction_${identifiedTokenInstruction}`;
    parsedInstruction.value = instruction;
  }
  return parsedInstruction;
};

const parseComputeBudgetProgramInstruction = (instruction) => {
  const parsedInstruction = {};
  const identifiedComputeBudgetInstruction = SolComputeBudget.identifyComputeBudgetInstruction(instruction);
  if (identifiedComputeBudgetInstruction === SolComputeBudget.ComputeBudgetInstruction.SetComputeUnitLimit) {
    const parsedSetComputeUnitLimitInstruction = SolComputeBudget.parseSetComputeUnitLimitInstruction(instruction);
    parsedInstruction.key = instructionKeys.SET_COMPUTE_UNIT_LIMIT;
    parsedInstruction.value = {
      computeUnitLimit: parsedSetComputeUnitLimitInstruction.data.units
    };
  } else if (identifiedComputeBudgetInstruction === SolComputeBudget.ComputeBudgetInstruction.SetComputeUnitPrice) {
    const parsedSetComputeUnitPriceInstruction = SolComputeBudget.parseSetComputeUnitPriceInstruction(instruction);
    parsedInstruction.key = instructionKeys.SET_COMPUTE_UNIT_PRICE;
    parsedInstruction.value = {
      priority: true,
      microLamports: Number(parsedSetComputeUnitPriceInstruction.data.microLamports)
    };
  } else {
    parsedInstruction.key = `unparsedComputeBudgetInstruction_${identifiedComputeBudgetInstruction}`;
    parsedInstruction.value = instruction;
  }
  return parsedInstruction;
};


/**
 * @typedef {Object} TransferSolInstruction
 * @property {number} amount - Amount of SOL to transfer in lamports
 * @property {'SOL'} currency - Currency type, always "SOL"
 * @property {string} destination - Destination wallet address
 * @property {string} source - Source wallet address
 */

/**
 * @typedef {Object} AdvanceNonceAccountInstruction
 * @property {string} nonceAccount - Address of the nonce account
 * @property {string} nonceAuthority - Address of the nonce authority
 */

/**
 * @typedef {Object} SetComputeUnitLimitInstruction
 * @property {number} computeUnitLimit - Maximum compute units allowed
 */

/**
 * @typedef {Object} SetComputeUnitPriceInstruction
 * @property {true} priority - Whether this is a priority transaction
 * @property {number} microLamports - Price in micro-lamports per compute unit
 */

/**
 * @typedef {Object} MemoInstruction
 * @property {string} memo - Memo text content
 */

/**
 * @typedef {Object} TransferCheckedTokenInstruction
 * @property {number} amount
 * @property {string} authority
 * @property {number} decimals
 * @property {string} destination
 * @property {string} mint
 * @property {string} source
 */

/**
 * @typedef {Object} TransferTokenInstruction
 * @property {number} amount
 * @property {string} authority
 * @property {string} destination
 * @property {string} source
 */

/**
 * May also include additional unknown instructions
 * @typedef {Object} Instructions
 * @property {TransferSolInstruction[]} [transferSol]
 * @property {AdvanceNonceAccountInstruction[]} [advanceNonceAccount]
 * @property {SetComputeUnitLimitInstruction[]} [setComputeUnitLimit]
 * @property {SetComputeUnitPriceInstruction[]} [setComputeUnitPrice]
 * @property {MemoInstruction[]} [memo]
 * @property {TransferCheckedTokenInstruction[]} [transferCheckedToken]
 * @property {TransferTokenInstruction[]} [transferToken]
 */