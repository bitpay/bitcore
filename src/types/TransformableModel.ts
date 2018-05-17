import mongoose = require('mongoose');
type TransformProperty<T> = {_apiTransform: (model: T, options: TransformOptions) => any};
import { TransformOptions } from "./TransformOptions";
export type TransformableModel<T extends mongoose.Document> = mongoose.Model<T> & TransformProperty<T>;

