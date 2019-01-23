import { BaseModel, MongoBound } from '../models/base';
type TransformProperty<T> = { _apiTransform: (model: T | MongoBound<T>) => any };
export type TransformableModel<T> = BaseModel<T> & TransformProperty<T>;
