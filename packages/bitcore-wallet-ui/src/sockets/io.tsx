import SocketIO from 'socket.io-client';
export const socket = SocketIO('http://localhost:3000', {
  transports: ['websocket']
});
