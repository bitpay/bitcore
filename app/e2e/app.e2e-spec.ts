import { browser, element, by } from 'protractor';

describe('ClickerApp', () => {

  beforeEach(() => {
    browser.get('');
  });

  it('should have a title', () => {
    expect(browser.getTitle()).toEqual('Clickers');
  });

  it('should have {nav}', () => {
    expect(element(by.css('ion-navbar')).isPresent()).toEqual(true);
  });

  it('should have correct nav text for Home', () => {
    expect(element(by.css('ion-navbar:first-child')).getText()).toContain('Clickers');
  });

  it('has a menu button that displays the left menu', () => {
    element(by.css('.bar-button-menutoggle')).click()
      .then(() => {
        browser.driver.sleep(2000); // wait for the animation
        expect(element.all(by.css('.toolbar-title')).first().getText()).toEqual('Pages');
      });
  });

  it('the left menu has a link with title Clickers', () => {
    element(by.css('.bar-button-menutoggle')).click()
      .then(() => {
        browser.driver.sleep(2000); // wait for the animation
        expect(element.all(by.css('ion-label')).first().getText()).toEqual('Clickers');
      });
  });

  it('the left menu has a link with title Goodbye Ionic', () => {
    element(by.css('.bar-button-menutoggle')).click()
      .then(() => {
        browser.driver.sleep(2000); // wait for the animation
        expect(element.all(by.css('ion-label')).last().getText()).toEqual('Goodbye Ionic');
      });
  });
});
