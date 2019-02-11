import { Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Observable } from 'rxjs';
import { map, take } from 'rxjs/operators';
import { ConfigService } from '../../services/config/config.service';

@Component({
  selector: 'app-outputs-page',
  templateUrl: 'outputs.page.html',
  styleUrls: ['outputs.page.scss']
})
export class OutputsPage {
  txHash$: Observable<string> = this.route.params.pipe(
    take(1),
    map(param => param['hash'])
  );
  constructor(public config: ConfigService, private route: ActivatedRoute) {}
}
