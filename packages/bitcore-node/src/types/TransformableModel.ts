import { TransformOptions } from "./TransformOptions";
import { BaseModel, MongoBound } from "../models/base";
type TransformProperty<T> = {_apiTransform: (model: T | MongoBound<T>, options?: TransformOptions) => any};
export type TransformableModel<T> = BaseModel<T> & TransformProperty<T>;

