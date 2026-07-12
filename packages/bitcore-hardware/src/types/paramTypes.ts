export interface BaseParams { index: number };

export type SignParams = BaseParams & { message: string; password?: string };
