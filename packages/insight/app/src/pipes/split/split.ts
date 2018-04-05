import { Pipe, PipeTransform } from '@angular/core';

/**
 * Generated class for the SplitPipe pipe.
 *
 * See https://angular.io/docs/ts/latest/guide/pipes.html for more info on
 * Angular Pipes.
 */
@Pipe({
  name: 'split'
})
export class SplitPipe implements PipeTransform {
  /**
   * Takes a value and makes it lowercase.
   */
  public transform(value: string, delimiter: string): Array<string> {
    let array: Array<string> = value.split(delimiter);
    return array;
  }
}
