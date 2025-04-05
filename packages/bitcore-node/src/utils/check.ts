export function isUndefined<T>(value: T) {
  return value === undefined;
}

export function valueOrDefault<T>(value: T | undefined, defaultVal: T): T {
  return value != undefined ? value : defaultVal;
}

export function isDateValid(dateStr: string): boolean {
  if (!dateStr) return false;
  return !isNaN(new Date(dateStr).getTime());
}