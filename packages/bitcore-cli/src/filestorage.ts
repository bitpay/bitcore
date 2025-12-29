import fs from 'fs';
import path from 'path';
import { Utils } from './utils';

export class FileStorage {
  filename: string;

  constructor (opts: { filename: string }) {
    if (!opts.filename) {
      throw new Error('Please set wallet filename');
    }
    this.filename = opts.filename;
  }

  getName() {
    return this.filename;
  }

  async save(data: string) {
    // Ensure parent directory exists
    await fs.promises.mkdir(path.dirname(this.filename), { recursive: true });
    await fs.promises.writeFile(this.filename, data);
  }

  async load() {
    try {
      let data = await fs.promises.readFile(this.filename, 'utf8');
      data = Utils.jsonParseWithBuffer(data);
    // Parsed JSON input (runtime-validated)
    return data as unknown;
    } catch {
      Utils.die('Invalid input file');
    }
  }

  exists() {
    return fs.existsSync(this.filename);
  }
};