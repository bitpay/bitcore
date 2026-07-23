export interface BaseParams { index: number };

export type SignParams = BaseParams & { tx: object; password?: string };
