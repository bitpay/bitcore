import { EventEmitter } from 'events';
import { Response } from 'express';
import { TransformableModel } from '../types/TransformableModel';
import logger from '../logger';
import config from '../config';
import { LoggifyClass } from '../decorators/Loggify';
import { ObjectID } from 'bson';
import { MongoClient, Db, Cursor } from 'mongodb';
import { MongoBound } from '../models/base';
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

  validPagingProperty<T>(model: TransformableModel<T>, property: keyof MongoBound<T>) {
    const defaultCase = property === '_id';
    return defaultCase || model.allowedPaging.some(prop => prop.key === property);
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
      } else if (modelKey == '_id') {
        typecastedValue = new ObjectID(oldValue) as any;
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
    let query: any = {};
    let since: any = {};
    let options: StreamingFindOptions<T> = {};
    if (originalOptions.paging && this.validPagingProperty(model, originalOptions.paging)) {
      if (originalOptions.since !== undefined) {
        since = this.typecastForDb(model, originalOptions.paging, originalOptions.since);
      }
      if (originalOptions.direction && Number(originalOptions.direction) === 1) {
        if (since) {
          query[originalOptions.paging] = { $gt: since };
        }
        options.sort = { [originalOptions.paging]: 1 };
      } else {
        if (since) {
          query[originalOptions.paging] = { $lt: since };
        }
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
