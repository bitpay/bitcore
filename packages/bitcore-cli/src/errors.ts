export class UserCancelled extends Error {
  constructor() {
    super('Cancelled by user');
  }
};

