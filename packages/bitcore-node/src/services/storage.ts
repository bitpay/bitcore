import { EventEmitter } from 'events';
import { Response } from "express";
import { TransformableModel } from "../types/TransformableModel";
import logger from '../logger';
import config from '../config';
import { LoggifyClass } from "../decorators/Loggify";
import { MongoClient, Db } from "mongodb";
import "../models"

@LoggifyClass
export class StorageService {
  client?: MongoClient;
  db?: Db;
  connected: boolean = false;
  connection = new EventEmitter();

  start(args: any): Promise<MongoClient> {
    return new Promise((resolve, reject) => {
      let options = Object.assign({}, config, args);
      let { dbName, dbHost } = options;
      const connectUrl = `mongodb://${dbHost}/${dbName}?socketTimeoutMS=3600000&noDelay=true`;
      let attemptConnect = async () => {
        return MongoClient.connect(connectUrl, {
          keepAlive: 1,
          poolSize: config.maxPoolSize,
          /*
           *nativeParser: true
           */
        });
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
            reject(new Error("Failed to connect to database"));
          }
        }
      }, 5000);
    });
  }

  stop() {}

  apiStreamingFind<T>(
    model: TransformableModel<T>,
    query: any,
    res: Response
  ) {

    let cursor = model.collection.find(query).stream({
      transform: model._apiTransform
    });
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
}

export let Storage = new StorageService();
