import { EventEmitter } from 'events';
import { Request, Response } from 'express';
import { TransformableModel } from '../types/TransformableModel';
import logger from '../logger';
import { LoggifyClass } from '../decorators/Loggify';
import { ObjectID } from 'mongodb';
import { MongoClient, Db, Cursor } from 'mongodb';
import { MongoBound } from '../models/base';
import '../models';
import { StreamingFindOptions } from '../types/Query';
import { ConfigType } from '../types/Config';
import { Config, ConfigService } from './config';
import { Readable } from 'stream';

export { StreamingFindOptions };

@LoggifyClass
export class StorageService {
  client?: MongoClient;
  db?: Db;
  connected: boolean = false;
  connection = new EventEmitter();
  configService: ConfigService;

  constructor({ configService = Config } = {}) {
    this.configService = configService;
  }

  start(args: Partial<ConfigType> = {}): Promise<MongoClient> {
    return new Promise((resolve, reject) => {
      let options = Object.assign({}, this.configService.get(), args);
      let { dbName, dbHost, dbPort } = options;
      const connectUrl = `mongodb://${dbHost}:${dbPort}/${dbName}?socketTimeoutMS=3600000&noDelay=true`;
      let attemptConnect = async () => {
        return MongoClient.connect(
          connectUrl,
          {
            keepAlive: true,
            poolSize: options.maxPoolSize,
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

  async stop() {}

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

  stream(input: Readable, req: Request, res: Response) {
    let closed = false;
    req.on('close', function() {
      closed = true;
    });
    res.on('close', function() {
      closed = true;
    });
    input.on('error', function(err) {
      if (!closed) {
        closed = true;
        return res.status(500).end(err.message);
      }
    });
    let isFirst = true;
    res.type('json');
    input.on('data', function(data) {
      if (!closed) {
        if (isFirst) {
          res.write('[\n');
          isFirst = false;
        } else {
          res.write(',\n');
        }
        res.write(JSON.stringify(data));
      }
    });
    input.on('end', function() {
      if (!closed) {
        if (isFirst) {
          // there was no data
          res.write('[]');
        } else {
          res.write('\n]');
        }
        res.end();
      }
    });
  }

  apiStream<T>(cursor: Cursor<T>, req: Request, res: Response) {
    let closed = false;
    req.on('close', function() {
      closed = true;
      cursor.close();
    });
    res.on('close', function() {
      closed = true;
      cursor.close();
    });
    cursor.on('error', function(err) {
      if (!closed) {
        closed = true;
        return res.status(500).end(err.message);
      }
    });
    let isFirst = true;
    res.type('json');
    cursor.on('data', function(data) {
      if (!closed) {
        if (isFirst) {
          res.write('[\n');
          isFirst = false;
        } else {
          res.write(',\n');
        }
        res.write(data);
      } else {
        cursor.close();
      }
    });
    cursor.on('end', function() {
      if (!closed) {
        if (isFirst) {
          // there was no data
          res.write('[]');
        } else {
          res.write('\n]');
        }
        res.end();
      }
    });
  }
  getFindOptions<T>(model: TransformableModel<T>, originalOptions: StreamingFindOptions<T>) {
    let query: any = {};
    let since: any = null;
    let options: StreamingFindOptions<T> = {};

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
    req: Request,
    res: Response,
    transform?: (data: T) => string | Buffer
  ) {
    const { query, options } = this.getFindOptions(model, originalOptions);
    const finalQuery = Object.assign({}, originalQuery, query);
    let cursor = model.collection
      .find(finalQuery, options)
      .addCursorFlag('noCursorTimeout', true)
      .stream({
        transform: transform || model._apiTransform
      });
    if (options.sort) {
      cursor = cursor.sort(options.sort);
    }
    return this.apiStream(cursor, req, res);
  }
}

export let Storage = new StorageService();
