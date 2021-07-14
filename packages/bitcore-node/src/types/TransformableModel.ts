import { BaseModel, MongoBound } from '../models/base';
import { TransformOptions } from './TransformOptions';
interface TransformProperty<T> {
  _apiTransform: (model: T | MongoBound<T>, options?: TransformOptions) => any;
}
export type TransformableModel<T> = BaseModel<T> & TransformProperty<T>;
