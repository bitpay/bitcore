import { Component }       from '@angular/core';
import { NavController }   from 'ionic-angular';

@Component({
  templateUrl: './blocksPage.html',
})

export class BlocksPage {

  public title: string;
  private nav: NavController;
  private blocks: any;

  constructor(nav: NavController) {
    this.nav = nav;
    this.title = 'Blocks';
    this.blocks = [{"height":471569,"size":999095,"hash":"00000000000000000007bf61c6cf9efbb1353b919621768b553bd1ffb2948240","time":1497633772,"txlength":2561,"poolInfo":{}},{"height":471568,"size":999994,"hash":"000000000000000000fc2c10f1b4e55c9b86b8f9e804dc66683312b7d7d955dd","time":1497632268,"txlength":2011,"poolInfo":{}},{"height":471567,"size":989172,"hash":"000000000000000000d70effc2ec625999960bd7929d7a4298124456ecb29c23","time":1497632133,"txlength":1651,"poolInfo":{"poolName":"BTCC Pool","url":"https://pool.btcc.com/"}},{"height":471566,"size":998155,"hash":"00000000000000000127cbc53d017400eb9d17122a8ae36986c077ac7eea25fe","time":1497629915,"txlength":1130,"poolInfo":{"poolName":"AntMiner","url":"https://bitmaintech.com/"}},{"height":471565,"size":998103,"hash":"00000000000000000045844f32f6e9fc6e7575bb96eb71a9ce9fba2849892d5e","time":1497629731,"txlength":1986,"poolInfo":{}},{"height":471564,"size":998101,"hash":"0000000000000000009a5b3fc7ac517f8a275be73f4492adb0cb88943f5c1b9e","time":1497629348,"txlength":2378,"poolInfo":{}},{"height":471563,"size":998258,"hash":"00000000000000000048a5506f3415fcf790106a838953e04d86d8f2583ebd6a","time":1497628552,"txlength":1481,"poolInfo":{"poolName":"AntMiner","url":"https://bitmaintech.com/"}},{"height":471562,"size":998257,"hash":"0000000000000000016f6a483730bd9c1c48c8345782b8365762592a475aa330","time":1497628159,"txlength":646,"poolInfo":{"poolName":"AntMiner","url":"https://bitmaintech.com/"}},{"height":471561,"size":999016,"hash":"000000000000000001434fb0e5cc5e521de59bff70c325185a5c67bd5418c61a","time":1497627986,"txlength":1831,"poolInfo":{}},{"height":471560,"size":998229,"hash":"000000000000000000a1782a9d78672672e4291347c47ac3206ed8716bb4952b","time":1497627524,"txlength":791,"poolInfo":{"poolName":"SlushPool","url":"https://slushpool.com/"}},{"height":471559,"size":999152,"hash":"000000000000000000d58ba85b2ddedc1f467b1e1c49c47cf62d4d970dad7ab5","time":1497627347,"txlength":87,"poolInfo":{}},{"height":471558,"size":778220,"hash":"0000000000000000009a4e72a1863e42fdfe1e08e6d547d4528049065d69454c","time":1497627287,"txlength":1685,"poolInfo":{"poolName":"BTCC Pool","url":"https://pool.btcc.com/"}},{"height":471557,"size":707456,"hash":"00000000000000000068a8adc72fc41299105053e6059a3f6dcd2e0dc2fd2fcb","time":1497626859,"txlength":1661,"poolInfo":{"poolName":"BTCC Pool","url":"https://pool.btcc.com/"}}];
  }
}
