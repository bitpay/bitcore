import { Component } from '@angular/core';
import { Platform } from '@ionic/angular';
import { ConfigService } from './services/config/config.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss']
})
export class AppComponent {
  constructor(private platform: Platform, public config: ConfigService) {
    this.initializeApp();
  }

  initializeApp() {
    this.platform.ready().then(() => {});
  }
}
