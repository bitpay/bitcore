export interface IProvider {
  name: string;
  getUrl: (code: string) => string;
  parseFn: (raw: any) => Array<IRates>
}

export interface IRates {
  code: string;
  value: number;
}
