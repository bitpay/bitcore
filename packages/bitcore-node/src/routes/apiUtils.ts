import { Response } from 'express';
import { AdapterError, AdapterErrorCode, AllProvidersUnavailableError } from '../providers/chain-state/external/adapters/errors';

export function respondWithError(res: Response, err: any) {
  if (err instanceof AllProvidersUnavailableError) {
    return res.status(503).json({ error: 'All indexed API providers unavailable', message: err.message });
  }
  if (err instanceof AdapterError && err.code === AdapterErrorCode.INVALID_REQUEST) {
    return res.status(400).json({ error: 'Invalid request', message: err.message });
  }
  return res.status(500).send(err.message || err);
}
