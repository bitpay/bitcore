'use strict';

import * as crypto from 'crypto';

/**
 * BufferIO - input/output class that NEVER stores values as strings
 */
class BufferIO {
  maxInputLength: number;

  constructor() {
    this.maxInputLength = 256;
  }

  /**
   * Reads user input directly into a buffer with secure cleanup
   */
  async readIn(prompt = 'Input: ') {
    return new Promise((resolve, reject) => {
      const inputBuffer = Buffer.alloc(this.maxInputLength);
      let position = 0;
      let terminalRestored = false;
      let signalHandlersAdded = false;

      // Display prompt
      process.stdout.write(prompt);

      // Set raw mode to capture individual keystrokes
      process.stdin.setRawMode(true);
      process.stdin.resume();

      const cleanup = () => {
        if (!terminalRestored) {
          try {
            process.stdin.setRawMode(false);
            process.stdin.pause();
            process.stdin.removeAllListeners('data');
            terminalRestored = true;
          } catch {/** no op */}
        }
        
        // Remove signal handlers
        if (signalHandlersAdded) {
          process.removeListener('SIGINT', signalHandler);
          process.removeListener('SIGTERM', signalHandler);
          signalHandlersAdded = false;
        }
      };

      const secureCleanup = () => {
        cleanup();
        crypto.randomFillSync(inputBuffer);
      };

      const dataHandler = (data) => {
        try {
          // Validate input data
          if (!Buffer.isBuffer(data)) {
            secureCleanup();
            reject(new Error('Invalid input data received'));
            return;
          }

          // Handle each byte in the buffer
          for (let i = 0; i < data.length; i++) {
            const byte = data[i];

            // Ctrl + C
            if (byte === 0x03) { // Ctrl+C
              secureCleanup();
              reject(new Error('Input cancelled by user'));
              return;
            }

            // Enter/return
            if (byte === 0x0D || byte === 0x0A) { // \r or \n
              process.stderr.write('\n');
              cleanup();

              // Create result buffer with exact length
              const resultBuffer = Buffer.alloc(position);
              inputBuffer.copy(resultBuffer, 0, 0, position);

              // Clear working buffer
              crypto.randomFillSync(inputBuffer);

              resolve(resultBuffer);
              return;
            }

            // Backspace/delete
            if (byte === 0x7F || byte === 0x08) { // DEL or BS
              if (position > 0) {
                position--;
                inputBuffer[position] = 0; // clear character
              }
              continue;
            }

            // Only accept printable ASCII characters (32-126)
            if (byte >= 32 && byte <= 126) {
              if (position < this.maxInputLength - 1) {
                inputBuffer[position] = byte;
                position++;
              }
            }
            // Skip non-printable characters silently
          }
        } catch (err) {
          secureCleanup();
          reject(err);
        }
      };

      // Handle process termination signals
      const signalHandler = () => {
        secureCleanup();
        process.exit(1);
      };

      process.stdin.on('data', dataHandler);
      process.once('SIGINT', signalHandler);
      process.once('SIGTERM', signalHandler);
      signalHandlersAdded = true;
    });
  }
}

export { BufferIO };
