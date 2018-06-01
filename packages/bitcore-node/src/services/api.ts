import app from '../routes';
import logger from '../logger';
import config from '../config';
import { LoggifyClass } from "../decorators/Loggify";

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
    const server = app.listen(this.port, () => {
      logger.info(`API server started on port ${this.port}`);
    });
    server.timeout = 600000
  }

  stop(){}

}

export const Api = new ApiService({
  port: config.port
});
