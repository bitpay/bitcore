export class UserCancelled extends Error {
  constructor() {
    super('Cancelled by user');
  }
};

export class ProcessCancelled extends Error {
  constructor() {
    super('Cancelled by process');
  }
}