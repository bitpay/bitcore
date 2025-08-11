/**
 * Merges the source object into the destination object.
 * For each property in the source object:
 * It sets the destination object property to the source property unless
 * both properties are object and the destination object property is not an array.
 *
 * @param object destination object
 * @param source source object
 */
export function merge<TDest, TSrc>(dest: TDest, src: TSrc): TDest & TSrc {
  for (const key in src) {
    const destProp = dest !== undefined ? (dest as any)[key] : undefined;
    const srcProp = src[key];
    let result;
    if (srcProp instanceof Object && destProp instanceof Object && !Array.isArray(destProp)) {
      result = merge(destProp, srcProp);
    } else {
      result = srcProp;
    }
    (dest as any)[key] = result;
  }
  return dest as TDest & TSrc;
}
export default merge;
