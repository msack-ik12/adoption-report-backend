import cors from 'cors';
import { config } from '../config';

export const corsMiddleware = cors({
  origin: [config.frontendOrigin, 'http://localhost:5173'],
  credentials: false,
  allowedHeaders: ['Content-Type', 'X-Internal-Token'],
  methods: ['GET', 'POST', 'OPTIONS'],
});
