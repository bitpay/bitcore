interface Task {
  task: any;
  argument: any;
  id: string;
}
export interface WorkerType {
  process: NodeJS.Process;
  send(task: Task): any;
}
