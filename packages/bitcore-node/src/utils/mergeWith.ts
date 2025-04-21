type MergeCustomizer = (
  objValue: any,
  srcValue: any,
  key: string | number,
  object: any,
  source: any
) => any;

/**
 * Recursively merges objects. 
 * Arrays are added together. 
 * Object properties are combined with source object properties as determined by customizer.
 * If the customizer returns undefined, the object property is set to the respective source property.
 * 
 * @param object destination object
 * @param source source object
 * @param customizer function to customize assigned values
 * @returns object
 */
export function mergeWith<TObject, TSource>(
object: TObject,
source: TSource,
customizer: MergeCustomizer
): TObject & TSource {
  for (const key in source) {
    const objProp = (object !== undefined) ? (object as any)[key] : undefined;
    const srcProp = source[key];
    const customizerApplied = customizer(objProp, srcProp, key, object, source);
    let result;
    if (customizerApplied !== undefined) {
      result = customizerApplied;
    } else if (objProp === undefined) {
      result = srcProp;
    } else if (Array.isArray(srcProp)) {
      result = objProp.concat(srcProp);
    } else if (srcProp instanceof Object) {
      result = mergeWith(objProp, srcProp, customizer);
    } else {
      result = srcProp;
    }
    (object as any)[key] = result;
  }
  return object as TObject & TSource;
}