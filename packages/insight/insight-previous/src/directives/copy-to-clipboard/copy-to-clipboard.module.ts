import { NgModule } from '@angular/core';
import { CopyToClipboardDirective } from './copy-to-clipboard.directive';

@NgModule({
  declarations: [CopyToClipboardDirective],
  exports: [CopyToClipboardDirective]
})
export class CopyToClipboardModule {}
