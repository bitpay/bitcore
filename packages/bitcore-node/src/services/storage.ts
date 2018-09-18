import { EventEmitter } from 'events';
import { Response } from 'express';
import { TransformableModel } from '../types/TransformableModel';
import logger from '../logger';
import config from '../config';
import { LoggifyClass } from '../decorators/Loggify';
import { MongoClient, Db, Cursor } from 'mongodb';
import '../models';

export type StreamingFindOptions<T> = Partial<{
  paging: keyof T;
  since: T[keyof T];
  sort: any;
  direction: 1 | -1;
  limit: number;
}>;
@LoggifyClass
export class StorageService {
  client?: MongoClient;
  db?: Db;
  connected: boolean = false;
  connection = new EventEmitter();

  start(args: any): Promise<MongoClient> {
    return new Promise((resolve, reject) => {
      let options = Object.assign({}, config, args);
      let { dbName, dbHost, dbPort } = options;
      const connectUrl = `mongodb://${dbHost}:${dbPort}/${dbName}?socketTimeoutMS=3600000&noDelay=true`;
      let attemptConnect = async () => {
        return MongoClient.connect(
          connectUrl,
          {
            keepAlive: true,
            poolSize: config.maxPoolSize,
            useNewUrlParser: true
          }
        );
      };
      let attempted = 0;
      let attemptConnectId = setInterval(async () => {
        try {
          this.client = await attemptConnect();
          this.db = this.client.db(dbName);
          this.connected = true;
          clearInterval(attemptConnectId);
          this.connection.emit('CONNECTED');
          resolve(this.client);
        } catch (err) {
          logger.error(err);
          attempted++;
          if (attempted > 5) {
            clearInterval(attemptConnectId);
            reject(new Error('Failed to connect to database'));
          }
        }
      }, 5000);
    });
  }

  stop() {}

  validPagingProperty<T>(model: TransformableModel<T>, property: keyof T) {
    return model.allowedPaging.some(prop => prop.key === property);
  }

  /**
   * castForDb
   *
   * For a given model, return the typecasted value based on a key and the type associated with that key
   */
  typecastForDb<T>(model: TransformableModel<T>, modelKey: keyof T, modelValue: T[keyof T]) {
    let typecastedValue = modelValue;
    if (modelKey) {
      let oldValue = modelValue as any;
      let optionsType = model.allowedPaging.find(prop => prop.key === modelKey);
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
      }
    }
    return typecastedValue;
  }

  apiStream<T>(cursor: Cursor<T>, res: Response) {
    cursor.on('error', function(err) {
      return res.status(500).end(err.message);
    });
    let isFirst = true;
    res.type('json');
    cursor.on('data', function(data) {
      if (isFirst) {
        res.write('[\n');
        isFirst = false;
      } else {
        res.write(',\n');
      }
      res.write(data);
    });
    cursor.on('end', function() {
      if (isFirst) {
        // there was no data
        res.write('[]');
      } else {
        res.write(']');
      }
      res.end();
    });
  }

  getFindOptions<T>(model: TransformableModel<T>, originalOptions: StreamingFindOptions<T>) {
    let options: StreamingFindOptions<T> = {};
    let query: any = {};
    if (
      originalOptions.since !== undefined &&
      originalOptions.paging &&
      this.validPagingProperty(model, originalOptions.paging)
    ) {
      options.since = this.typecastForDb(model, originalOptions.paging, originalOptions.since);
      if (originalOptions.direction && Number(originalOptions.direction) === 1) {
        query[originalOptions.paging] = { $gt: originalOptions.since };
        options.sort = { [originalOptions.paging]: 1 };
      } else {
        query[originalOptions.paging] = { $lt: originalOptions.since };
        options.sort = { [originalOptions.paging]: -1 };
      }
    }
    options.limit = Math.min(originalOptions.limit || 100, 1000);
    return { query, options };
  }

  apiStreamingFind<T>(
    model: TransformableModel<T>,
    originalQuery: any,
    originalOptions: StreamingFindOptions<T>,
    res: Response,
    transform?: (data: T) => string | Buffer
  ) {
    const { query, options } = this.getFindOptions(model, originalOptions);
    const finalQuery = Object.assign({}, originalQuery, query);
    let cursor = model.collection.find(finalQuery, options).stream({
      transform: transform || model._apiTransform
    });
    return this.apiStream(cursor, res);
  }
}

export let Storage = new StorageService();
