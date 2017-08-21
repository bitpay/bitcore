import { browser, element, by, ElementFinder } from 'protractor';

describe('BroadcastTxPage', () => {

  beforeEach(() => {
    browser.get('');
  });

  it('should have an input field', () => {
    element(by.css('.bar-button-menutoggle')).click().then(() => {
      browser.driver.sleep(2000); // wait for the animation
      element.all(by.className('input-wrapper')).then((items) => {
        items[2].click();
        browser.driver.sleep(2000); // wait for the animation
        let theElem = element.all(by.css('ion-label')).first;
        console.log(theElem);
        expect(element.all(by.css('ion-input')).first().isPresent()).toEqual(true);
        return items[1];
      });
    });
  });
});
