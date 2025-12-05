import express from 'express';
import { WalletService } from 'src/lib/server';

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