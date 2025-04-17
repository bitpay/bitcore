import express from 'express';
import { WalletService } from 'src/lib/server';

export type ReturnErrorFn = (err: any, res: express.Response, req: express.Request) => void;
export type LogDeprecatedFn = (req: express.Request) => void;
export type GetCredentialsFn = (req: express.Request) => undefined | { copayerId: string; signature: string; session: string; };
export type GetServerFn = (req: express.Request, res: express.Response) => WalletService;
export interface ServerOpts { allowSession?: boolean; silentFailure?: boolean; onlySupportStaff?: boolean; onlyMarketingStaff?: boolean }
export type ServerCallback = (server: WalletService, err?: Error) => void;
export type GetServerWithAuthFn = (req: express.Request, res: express.Response, opts?: ServerOpts | ServerCallback, cb?: ServerCallback) => Promise<WalletService | void>;
export type GetServerWithMultiAuthFn = (req: express.Request, res: express.Response, opts?: ServerOpts) => Array<Promise<WalletService | void>>;