import { execHaloCmdPCSC } from '@arx-research/libhalo/api/desktop';
import { NFC } from 'nfc-pcsc';

const nfc = new NFC();

nfc.on('reader', (reader) => {
  reader.autoProcessing = false;
  console.log('Reader triggered');

  reader.on('card', async () => {
    console.log('Card triggered');

    try {
      const res = await execHaloCmdPCSC({
        name: 'sign',
        message: '010203',
        keyNo: 1,
      }, reader);
      console.log(res);
    } catch (e) {
      console.error(e);
    }
  });

  reader.on('error', (err) => {
    console.log(`${reader.reader.name} an error occurred`, err);
  });
});

nfc.on('error', (err) => {
  console.log('An error occurred', err);
});

console.log('Tap the tag...');
