import mongoose = require("mongoose");
import { Response } from "express";
import { TransformableModel } from "../types/TransformableModel";
import logger from '../logger';
import config from '../config';
import { LoggifyClass } from "../decorators/Loggify";
import "../models"

@LoggifyClass
export class StorageService {
  start(args: any): Promise<any> {
    return new Promise((resolve, reject) => {
      let options = Object.assign({}, config, args);
      let { dbName, dbHost } = options;
      const connectUrl = `mongodb://${dbHost}/${dbName}?socketTimeoutMS=3600000&noDelay=true`;
      let attemptConnect = async () => {
        return mongoose.connect(connectUrl, {
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
          let data = await attemptConnect();
          clearInterval(attemptConnectId);
          resolve(data);
        } catch (err) {
          logger.error(err);
          attempted++;
          if (attempted > 5) {
            clearInterval(attemptConnectId);
            reject(err);
          }
        }
      }, 5000);
    });
  }

  stop() {}

  apiStreamingFind(
    model: TransformableModel<any>,
    query: any,
    res: Response
  ) {

    let cursor = model.find(query).cursor({
      transform: model._apiTransform
    });
    cursor.on("error", function(err) {
      return res.status(500).end(err.message);
    });
    let isFirst = true;
    res.type("json");
    cursor.on("data", function(data) {
      if (isFirst) {
        res.write("[\n");
        isFirst = false;
      } else {
        res.write(",\n");
      }
      res.write(data);
    });
    cursor.on("end", function() {
      if (isFirst) {
        // there was no data
        res.write("[]");
      } else {
        res.write("]");
      }
      res.end();
    });
  }
}

export let Storage = new StorageService();
