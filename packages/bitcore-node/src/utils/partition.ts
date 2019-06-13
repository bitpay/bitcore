export function partition<T>(array: T[], n: number): T[][] {
  n = n > 0 ? Math.ceil(n) : 1;
  return array.length ? [array.splice(0, n)].concat(partition(array, n)) : [];
}
