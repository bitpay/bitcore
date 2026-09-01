import { EventEmitter } from 'events';
import { Readable } from 'stream';
import { ObjectId } from 'bson';
import { ObjectID } from 'mongodb';
import { Db, MongoClient } from 'mongodb';
import { LoggifyClass } from '../decorators/Loggify';
import logger from '../logger';
import '../models';
import { MongoBound } from '../models/base';
import { ConfigType } from '../types/Config';
import { StreamingFindOptions } from '../types/Query';
import { TransformableModel } from '../types/TransformableModel';
import { wait } from '../utils';
import { Config, ConfigService } from './config';

export { StreamingFindOptions };

@LoggifyClass
export class StorageService {
  client?: MongoClient;
  db?: Db;
  connected: boolean = false;
  connection = new EventEmitter();
  configService: ConfigService;
  modelsConnected = new Array<Promise<any>>();

  constructor({ configService = Config } = {}) {
    this.configService = configService;
    this.connection.setMaxListeners(30);
  }

  start(args: Partial<ConfigType> = {}): Promise<MongoClient> {
    return new Promise((resolve, reject) => {
      const options = Object.assign({}, this.configService.get(), args);
      const { dbUrl, dbName, dbHost, dbPort, dbUser, dbPass, dbReadPreference } = options;
      const auth = dbUser !== '' && dbPass !== '' ? `${dbUser}:${dbPass}@` : '';
      const connectUrl = dbUrl
        ? dbUrl
        : `mongodb://${auth}${dbHost}:${dbPort}/${dbName}?socketTimeoutMS=3600000&noDelay=true${dbReadPreference ? `?readPreference=${dbReadPreference}` : ''}`;
      const attemptConnect = async () => {
        return MongoClient.connect(connectUrl, {
          keepAlive: true,
          poolSize: options.maxPoolSize,
          useNewUrlParser: true
        });
      };
      let attempted = 0;
      const attemptConnectId = setInterval(() => {
        (async () => {
          try {
            this.client = await attemptConnect();
            this.db = this.client.db(dbName);
            this.connected = true;
            clearInterval(attemptConnectId);
            this.connection.emit('CONNECTED');
            resolve(this.client);
          } catch (err: any) {
            logger.error('%o', err);
            attempted++;
            if (attempted > 5) {
              clearInterval(attemptConnectId);
              reject(new Error('Failed to connect to database'));
            }
          }
        })();
      }, 5000);
    });
  }

  async stop() {
    if (this.client) {
      logger.info('Stopping Storage Service');
      await wait(5000);
      this.connected = false;
      await Promise.all(this.modelsConnected);
      await this.client.close();
      this.connection.emit('DISCONNECTED');
    }
  }

  validPagingProperty<T>(model: TransformableModel<T>, property: keyof MongoBound<T>) {
    const defaultCase = property === '_id';
    return defaultCase || model.allowedPaging.some(prop => prop.key === property);
  }

  /**
   * castForDb
   *
   * For a given model, return the typecasted value based on a key and the type associated with that key
   */
  typecastForDb<T>(model: TransformableModel<T>, modelKey: keyof MongoBound<T>, modelValue: T[keyof T] | ObjectId) {
    let typecastedValue = modelValue;
    if (modelKey) {
      const oldValue = modelValue as any;
      const optionsType = model.allowedPaging.find(prop => prop.key === modelKey);
      if (optionsType) {
        switch (optionsType.type) {
          case 'number':
            typecastedValue = Number(oldValue) as any;
            break;
          case 'string':
            typecastedValue = (oldValue || '').toString() as any;
            break;
          case 'date':
            typecastedValue = new Date(oldValue) as any;
            break;
        }
      } else if (modelKey == '_id') {
        typecastedValue = new ObjectID(oldValue) as any;
      }
    }
    return typecastedValue;
  }

  getFindOptions<T>(model: TransformableModel<T>, originalOptions: StreamingFindOptions<T>) {
    const query: any = {};
    let since: any = null;
    const options: StreamingFindOptions<T> = {};

    if (originalOptions.sort) {
      options.sort = originalOptions.sort;
    }
    if (originalOptions.paging && this.validPagingProperty(model, originalOptions.paging)) {
      if (originalOptions.since !== undefined) {
        since = this.typecastForDb(model, originalOptions.paging, originalOptions.since);
      }
      if (originalOptions.direction && Number(originalOptions.direction) === 1) {
        if (since) {
          query[originalOptions.paging] = { $gt: since };
        }
        options.sort = Object.assign({}, originalOptions.sort, { [originalOptions.paging]: 1 });
      } else {
        if (since) {
          query[originalOptions.paging] = { $lt: since };
        }
        options.sort = Object.assign({}, originalOptions.sort, { [originalOptions.paging]: -1 });
      }
    }
    if (originalOptions.limit) {
      options.limit = Number(originalOptions.limit);
    }
    return { query, options };
  }

  apiStreamingFind<T>(
    model: TransformableModel<T>,
    originalQuery: any,
    originalOptions: StreamingFindOptions<T>,
    transform?: (data: T) => string | Buffer
  ): Readable & { close?: () => void } {
    const { query, options } = this.getFindOptions(model, originalOptions);
    const finalQuery = Object.assign({}, originalQuery, query);
    let cursor = model.collection
      .find(finalQuery, options)
      .addCursorFlag('noCursorTimeout', true)
      .stream({
        transform: transform || model._apiTransform.bind(model)
      });
    if (options.sort) {
      cursor = cursor.sort(options.sort);
    }
    return cursor;
  }
}

export const Storage = new StorageService();
