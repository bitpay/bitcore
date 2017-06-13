export class ClickersServiceMock {

  public doClick(): boolean {
    return true;
  }

  public newClicker(): boolean {
    return true;
  }

  public getClickers(): Array<string> {
    return [];
  }
}
