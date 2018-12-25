export function isUndefined<T>(value: T) {
  return value === undefined;
}

export function valueOrDefault<T>(value: T | undefined, defaultVal: T): T {
  return value !== undefined ? value : defaultVal;
}

export function transformOrDefault<T, K>(value: T | undefined, transform: (val: T) => K, defaultVal: K) {
  return value !== undefined ? transform(value) : defaultVal;
}
