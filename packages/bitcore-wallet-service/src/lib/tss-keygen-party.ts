import { Errors } from './errors/errordefinitions';

/**
 * Bind a keygen submitter to a single party slot.
 * Sign already checks (copayerId, partyId). Keygen did not.
 */
export function assertKeygenPartyOwnership(params: {
  participants: Array<string | null | undefined>;
  partyId: number;
  copayerId: string;
  n: number;
}): void {
  const { participants, partyId, copayerId, n } = params;

  if (!Number.isInteger(partyId) || partyId < 0 || partyId >= n) {
    throw Errors.TSS_INVALID_MESSAGE.withMessage('Invalid partyId provided: ' + partyId);
  }

  const occupiedBy = participants[partyId];
  if (occupiedBy && occupiedBy !== copayerId) {
    throw Errors.TSS_NON_PARTICIPANT.withMessage('Party already claimed');
  }

  const existingParty = participants.findIndex((participant) => participant === copayerId);
  if (existingParty !== -1 && existingParty !== partyId) {
    throw Errors.TSS_MAX_PARTICIPANTS_REACHED.withMessage('Copayer already joined as a different party');
  }
}
