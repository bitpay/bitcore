import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'split'
})
export class SplitPipe implements PipeTransform {
  /**
   * Takes a value and makes it lowercase.
   */
  public transform(value: string, delimiter: string): string[] {
    const array: string[] = value.split(delimiter);
    return array;
  }
}
