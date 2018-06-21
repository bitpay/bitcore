import { TransformOptions } from "./TransformOptions";
import { BaseModel } from "../models/base";
type TransformProperty<T> = {_apiTransform: (model: T, options: TransformOptions) => any};
export type TransformableModel<T> = BaseModel<T> & TransformProperty<T>;

