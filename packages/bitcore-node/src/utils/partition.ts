export function partition<T>(array: T[], n: number): T[][] {
  return array.length ? [array.splice(0, n)].concat(partition(array, n)) : [];
}
