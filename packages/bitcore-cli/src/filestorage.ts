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
      return data as any; // TODO provide a proper type
    } catch {
      Utils.die('Invalid input file');
    }
  }

  exists() {
    return fs.existsSync(this.filename);
  }

  /**
   * Returns the path to the state directory for this wallet, creating it if it doesn't exist.
   * The state directory is located at .state/<walletName> relative to the wallet file.
   */
  async getStatePath(): Promise<string> {
    const walletName = path.basename(this.filename, path.extname(this.filename));
    const statePath = path.join(path.dirname(this.filename), '.state', walletName);
    // Ensure state directory exists
    await fs.promises.mkdir(statePath, { recursive: true });
    return statePath;
  }
};