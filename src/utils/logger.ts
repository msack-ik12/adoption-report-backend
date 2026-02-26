const timestamp = () => new Date().toISOString();

export const logger = {
  info(msg: string, meta?: Record<string, unknown>) {
    console.log(JSON.stringify({ level: 'info', time: timestamp(), msg, ...meta }));
  },
  warn(msg: string, meta?: Record<string, unknown>) {
    console.warn(JSON.stringify({ level: 'warn', time: timestamp(), msg, ...meta }));
  },
  error(msg: string, meta?: Record<string, unknown>) {
    console.error(JSON.stringify({ level: 'error', time: timestamp(), msg, ...meta }));
  },
};
