import mongoose from 'mongoose';
import app from '../routes';
import logger from '../logger';
import config from '../config';
import { LoggifyClass } from '../decorators/Loggify';
import { Storage } from './storage';

@LoggifyClass
export class ApiService {

  port: number;
  timeout: number;

  constructor(options){
    const {
      port,
      timeout
    } = options;

    this.port = port || 3000;
    this.timeout = timeout || 600000;
  }

  async start(){
    if(mongoose.connection.readyState !== 1){
      await Storage.start({});
    }
    const server = app.listen(this.port, () => {
      logger.info(`API server started on port ${this.port}`);
    });
    server.timeout = this.timeout;
  }

  stop(){}

}

// TOOO: choose a place in the config for the API timeout and include it here
export const Api = new ApiService({
  port: config.port
});
