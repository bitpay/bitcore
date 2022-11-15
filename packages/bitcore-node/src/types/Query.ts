import { ObjectId } from 'bson';
export const enum Direction {
  ascending = 1,
  descending = -1
}

export type StreamingFindOptions<T> = Partial<{
  paging: keyof T | '_id';
  since: T[keyof T] | ObjectId;
  sort: any;
  direction: Direction;
  limit: number;
}>;
