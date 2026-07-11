import { dmk } from './dmk.js';


export default class Ledger {

  connect() {
    const subscription = dmk.listenToAvailableDevices().subscribe({
      next: (devices) => {
        // Handle the available devices here
        console.log(devices);
      },
      error: (error) => {
        console.error(error);
      },
      complete: () => {
        console.log('Completed');
      },
    });

    // Stop listening to available devices
    subscription.unsubscribe();
  }
}
