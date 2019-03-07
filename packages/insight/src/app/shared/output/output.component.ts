import { Component, Input } from '@angular/core';
import { CoinJSON } from '../../types/bitcore-node';

@Component({
  selector: 'app-output',
  templateUrl: './output.component.html',
  styleUrls: ['./output.component.scss']
})
export class OutputComponent {
  @Input()
  coin: CoinJSON;

  @Input()
  displayValueCode: string;

  @Input()
  summary = true;
}
