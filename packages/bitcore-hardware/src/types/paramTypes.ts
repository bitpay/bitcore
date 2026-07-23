export interface BaseParams { index: number };

export type SignParams = BaseParams & { tx: any; password?: string };
