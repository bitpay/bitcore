export type Partial<T> = { [key in keyof T]?: T[key] }
