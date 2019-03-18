import { HttpErrorResponse } from '@angular/common/http';
import { ErrorHandler, Injectable } from '@angular/core';
import { Logger } from '../logger/logger';
@Injectable()
export class ErrorsHandler implements ErrorHandler {
  constructor(private logger: Logger) {}
  handleError(error: Error | HttpErrorResponse) {
    if (error instanceof HttpErrorResponse) {
      // Server or connection error happened
      if (!navigator.onLine) {
        // Handle offline error
        this.logger.error('No Internet Connection');
      } else {
        // Handle Http Error (error.status === 403, 404...)
        this.logger.error(`${error.status} - ${error.message}`);
      }
    } else {
      // Handle Client Error (Angular Error, ReferenceError...)
      this.logger.error(error.message);
    }
  }
}
