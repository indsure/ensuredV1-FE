import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import { policyFetchRouter, attachWSS } from './routes/policy-fetch';

const app = express();
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:5412',
    'http://127.0.0.1:5412',
    'http://127.0.0.1:5413',
  ],
}));
app.use(express.json());
app.use('/api/policy', policyFetchRouter);

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws/policy-session' });
attachWSS(wss);

server.listen(3001, () => console.log('Server running on :3001'));

