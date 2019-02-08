import * as React from 'react';
import SocketIO from 'socket.io-client';
const socket = SocketIO('http://localhost:3000', { transports: ['websocket'] });
export const Socket = socket;
export const SocketContext = React.createContext(socket);
