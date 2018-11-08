export const enum Direction {
  ascending = 1,
  descending = -1
}

export type StreamingFindOptions<T> = Partial<{
  paging: keyof T;
  since: T[keyof T];
  sort: any;
  direction: Direction;
  limit: number;
}>;
