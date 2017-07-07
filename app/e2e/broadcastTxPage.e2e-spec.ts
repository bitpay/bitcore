import { browser, element, by, ElementFinder } from 'protractor';

let heading: ElementFinder = element(by.css('h1'));

describe('BroadcastTxPage', () => {

  beforeEach(() => {
    browser.get('');
  });

  it('should have the temporary heading', () => {
    element(by.css('.bar-button-menutoggle')).click().then(() => {
      browser.driver.sleep(2000); // wait for the animation
      element.all(by.className('input-wrapper')).then((items) => {
        items[1].click();
        browser.driver.sleep(2000); // wait for the animation
        expect(heading.getText()).toEqual('Broadcast Transaction');
        return items[1];
      });
    });
  });
});
