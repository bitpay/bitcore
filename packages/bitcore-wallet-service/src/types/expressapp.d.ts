import express from 'express';
import { WalletService } from 'src/lib/server';
import { Copayer } from '../lib/model';
import type { TssKeyGenModel } from '../lib/model/tsskeygen';
import type { TssSigGenModel } from '../lib/model/tsssign';

// Declares properties that auth/route middleware genuinely attaches to the
// request object at runtime (context.ts, walletdata.ts, authRequest.ts,
// authTssRequest.ts)
declare global {
  namespace Express {
    // compression middleware adds flush() to streaming responses.
    interface Response {
      flush(): void;
    }

    interface Request {
      redirectedUrl?: string;
      isSupportStaff?: boolean;
      walletId?: string;
      copayerId?: string;
      copayer?: Copayer;
      session?: TssKeyGenModel | TssSigGenModel | null;
    }
  }
}

export interface ApiCredentials { copayerId: string; signature: string; session: string }
export interface ServerOpts { allowSession?: boolean; silentFailure?: boolean; onlySupportStaff?: boolean; onlyMarketingStaff?: boolean }
export interface AuthRequestOpts { allowSession?: boolean; silentFailure?: boolean; onlySupportStaff?: boolean; onlyMarketingStaff?: boolean }

export type ReturnErrorFn = (err: any, res: express.Response, req: express.Request) => void;
export type LogDeprecatedFn = (req: express.Request) => void;
export type GetCredentialsFn = (req: express.Request) => undefined | ApiCredentials;
export type GetServerFn = (req: express.Request, res: express.Response) => WalletService;
export type ServerCallback = (server: WalletService, err?: Error) => void;
export type GetServerWithAuthFn = (req: express.Request, res: express.Response, opts?: ServerOpts | ServerCallback, cb?: ServerCallback) => Promise<WalletService | void>;
export type GetServerWithMultiAuthFn = (req: express.Request, res: express.Response, opts?: ServerOpts) => Array<Promise<WalletService | void>>;
export type CreateWalletLimiterFn = (req: express.Request, res: express.Response, next: express.NextFunction) => void;
export type CheckNumberFormatFn = (numberFormat: string | undefined, res: express.Response) => boolean;
