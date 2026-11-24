import { SolanaProgram } from '@bitpay-labs/crypto-wallet-core';

const {
  ComputeBudget: SolComputeBudget,
  Memo: SolMemo,
  System: SolSystem,
  Token: SolToken
} = SolanaProgram;

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

export interface TransferSolInstruction {
  /** Amount of SOL to transfer in lamports */
  amount: number;
  /** Currency type, always "SOL" */
  currency: 'SOL';
  /** Destination wallet address */
  destination: string;
  /** Source wallet address */
  source: string;
}

export interface AdvanceNonceAccountInstruction {
  /** Address of the nonce account */
  nonceAccount: string;
  /** Address of the nonce authority */
  nonceAuthority: string;
}

export interface SetComputeUnitLimitInstruction {
  /** Maximum compute units allowed */
  computeUnitLimit: number;
}

export interface SetComputeUnitPriceInstruction {
  /** Whether this is a priority transaction */
  priority: true;
  /** Price in micro-lamports per compute unit */
  microLamports: number;
}

export interface MemoInstruction {
  /** Memo text content */
  memo: string;
}

export interface TransferCheckedTokenInstruction {
  amount: number;
  authority: string;
  decimals: number;
  destination: string;
  mint: string;
  source: string;
}

export interface TransferTokenInstruction {
  amount: number;
  authority: string;
  destination: string;
  source: string;
}

export interface CreateAssociatedTokenInstruction {
  payer: string;
  associatedTokenAccount: string;
  owner: string;
  mint: string;
  tokenProgram: string;
}

export interface RecoverNestedAssociatedTokenInstruction {
  nestedAssociatedTokenAccount: string;
  nestedMint: string;
  destinationAssociatedTokenAccount: string;
  owner: string;
  mint: string;
  tokenProgram: string;
}

/**
 * Instructions grouped by kind. May also include additional unknown instructions, keyed
 * `unparsed<Program>Instruction_<discriminator>`. Inner instructions carry a `topLevelInstructionIndex` as well.
 */
export interface Instructions {
  transferSol?: TransferSolInstruction[];
  advanceNonceAccount?: AdvanceNonceAccountInstruction[];
  setComputeUnitLimit?: SetComputeUnitLimitInstruction[];
  setComputeUnitPrice?: SetComputeUnitPriceInstruction[];
  /** Top-level memos are parsed into an object; jsonParsed inner memos are the plain string */
  memo?: (MemoInstruction | string)[];
  transferCheckedToken?: TransferCheckedTokenInstruction[];
  transferToken?: TransferTokenInstruction[];
  createAssociatedToken?: CreateAssociatedTokenInstruction[];
  createAssociatedTokenIdempotent?: CreateAssociatedTokenInstruction[];
  recoverNestedAssociatedToken?: RecoverNestedAssociatedTokenInstruction[];
  unknownInstruction?: any[];
  [key: string]: any[] | undefined;
}

/** One instruction after parsing: the group it belongs under and what goes in that group */
export interface ParsedInstruction {
  key: string;
  value: any;
}

/**
 * @param {any[]} instructions 
 * @returns {Instructions}
 */
export const parseInstructions = (instructions: readonly any[]): Instructions => {
  const parsedInstructions: Instructions = {};
  for (const instruction of instructions) {
    const handledInstruction = parseInstruction(instruction);
    appendParsedInstruction(parsedInstructions, handledInstruction);
  }
  return parsedInstructions;
};

/**
 * Parses the `jsonParsed` RPC instruction shape into the same grouped output as `parseInstructions`.
 * @param {any[]} instructions
 * @returns {Instructions}
 */
export const parseJsonParsedInstructions = (instructions: readonly any[]): Instructions => {
  const parsedInstructions: Instructions = {};
  for (const instruction of instructions) {
    const handledInstruction = parseJsonParsedInstruction(instruction);
    appendParsedInstruction(parsedInstructions, handledInstruction);
  }
  return parsedInstructions;
};

const appendParsedInstruction = (parsedInstructions: Instructions, handledInstruction: ParsedInstruction) => {
  (parsedInstructions[handledInstruction.key] ||= []).push(handledInstruction.value);
};

const parseInstruction = (instruction: any): ParsedInstruction => {
  try {
    if (instruction.programAddress === SolSystem.SYSTEM_PROGRAM_ADDRESS) {
      return parseSystemProgramInstruction(instruction);
    } else if (instruction.programAddress === SolMemo.MEMO_PROGRAM_ADDRESS) {
      return parseMemoProgramInstruction(instruction);
    } else if (instruction.programAddress === SolToken.ASSOCIATED_TOKEN_PROGRAM_ADDRESS) {
      return parseAssociatedTokenProgramInstruction(instruction);
    } else if (instruction.programAddress === solTokenProgramAddress) {
      return parseTokenProgramInstruction(instruction);
    } else if (instruction.programAddress === SolComputeBudget.COMPUTE_BUDGET_PROGRAM_ADDRESS) {
      return parseComputeBudgetProgramInstruction(instruction);
    }

    return {
      key: instructionKeys.UNKNOWN,
      value: instruction
    };
  } catch (err) {
    return {
      key: instructionKeys.UNKNOWN,
      value: {
        ...instruction,
        error: (err as Error).message,
        programAddress: instruction.programAddress
      }
    };
  }
};

const parseJsonParsedInstruction = (instruction: any): ParsedInstruction => {
  try {
    if (instruction.programId === SolSystem.SYSTEM_PROGRAM_ADDRESS) {
      return parseJsonParsedSystemProgramInstruction(instruction);
    } else if (instruction.programId === SolMemo.MEMO_PROGRAM_ADDRESS) {
      return parseJsonParsedMemoProgramInstruction(instruction);
    } else if (instruction.programId === SolToken.ASSOCIATED_TOKEN_PROGRAM_ADDRESS) {
      return parseJsonParsedAssociatedTokenProgramInstruction(instruction);
    } else if (instruction.programId === solTokenProgramAddress) {
      return parseJsonParsedTokenProgramInstruction(instruction);
    } else if (instruction.programId === SolComputeBudget.COMPUTE_BUDGET_PROGRAM_ADDRESS) {
      return parseJsonParsedComputeBudgetProgramInstruction(instruction);
    }

    return {
      key: instructionKeys.UNKNOWN,
      value: normalizeJsonParsedInstruction(instruction)
    };
  } catch (err) {
    return {
      key: instructionKeys.UNKNOWN,
      value: {
        ...normalizeJsonParsedInstruction(instruction),
        error: (err as Error).message
      }
    };
  }
};

const parseSystemProgramInstruction = (instruction: any): ParsedInstruction => {
  const identifiedInstruction = SolSystem.identifySystemInstruction(instruction);
  const parsedInstruction = {} as ParsedInstruction;
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

const parseMemoProgramInstruction = (instruction: any): ParsedInstruction => {
  const parsedInstruction = {} as ParsedInstruction;
  const parsedMemoInstruction = SolMemo.parseAddMemoInstruction({ ...instruction }); // Only one instruction with MEMO_PROGRAM_ADDRESS
  parsedInstruction.key = instructionKeys.MEMO;
  parsedInstruction.value = parsedMemoInstruction.data;
  return parsedInstruction;
};

const parseJsonParsedMemoProgramInstruction = (instruction: any): ParsedInstruction => {
  const memo = instruction?.parsed;
  return {
    key: instructionKeys.MEMO,
    value: typeof memo === 'string' ? memo : instruction
  };
};

const parseAssociatedTokenProgramInstruction = (instruction: any): ParsedInstruction => {
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
    // TODO: @solana-program/token names these accounts nestedAssociatedAccountAddress,
    // nestedTokenMintAddress, destinationAssociatedAccountAddress, walletAddress and ownerTokenMintAddress, so
    // every read below is undefined and the instruction ends up in the unknown group with a TypeError
    const accounts: Record<string, { address: string }> = parsedRecoverInstruction.accounts;

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

const parseTokenProgramInstruction = (instruction: any): ParsedInstruction => {
  const parsedInstruction = {} as ParsedInstruction;
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

const parseJsonParsedSystemProgramInstruction = (instruction: any): ParsedInstruction => {
  const type = instruction?.parsed?.type;
  const info = instruction?.parsed?.info ?? {};
  if (type === 'transfer') {
    return {
      key: instructionKeys.TRANSFER_SOL,
      value: {
        // Note: This is different than info.amount for the way top-level transferSol instructions come through
        amount: Number(info.lamports),
        currency: 'SOL',
        destination: info.destination,
        source: info.source
      }
    };
  }

  return {
    key: instructionKeys.UNKNOWN,
    value: normalizeJsonParsedInstruction(instruction)
  };
};

const parseJsonParsedAssociatedTokenProgramInstruction = (instruction: any): ParsedInstruction => {
  return {
    key: instructionKeys.UNKNOWN,
    value: normalizeJsonParsedInstruction(instruction)
  };
};

// TODO: token amounts are u64, so Number() loses precision above 2^53 base units.
// The top-level parser does the same; fixing both changes the amount type.
const parseJsonParsedTokenProgramInstruction = (instruction: any): ParsedInstruction => {
  const type = instruction?.parsed?.type;
  const info = instruction?.parsed?.info ?? {};
  if (type === 'transfer') {
    return {
      key: instructionKeys.TRANSFER_TOKEN,
      value: {
        // jsonParsed gives a multisig-owned source's authority as multisigAuthority
        authority: info.authority ?? info.multisigAuthority,
        destination: info.destination,
        source: info.source,
        amount: Number(info.amount)
      }
    };
  } else if (type === 'transferChecked') {
    return {
      key: instructionKeys.TRANSFER_CHECKED_TOKEN,
      value: {
        authority: info.authority ?? info.multisigAuthority,
        destination: info.destination,
        mint: info.mint,
        source: info.source,
        // jsonParsed nests these under tokenAmount for transferChecked, unlike transfer
        amount: Number(info.amount ?? info.tokenAmount?.amount),
        decimals: Number(info.decimals ?? info.tokenAmount?.decimals)
      }
    };
  }

  return {
    key: instructionKeys.UNKNOWN,
    value: normalizeJsonParsedInstruction(instruction)
  };
};

const parseComputeBudgetProgramInstruction = (instruction: any): ParsedInstruction => {
  const parsedInstruction = {} as ParsedInstruction;
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

const parseJsonParsedComputeBudgetProgramInstruction = (instruction: any): ParsedInstruction => {
  return {
    key: instructionKeys.UNKNOWN,
    value: normalizeJsonParsedInstruction(instruction)
  };
};

const normalizeJsonParsedInstruction = (instruction: any) => {
  return {
    ...instruction,
    programAddress: instruction.programId
  };
};

