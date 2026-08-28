import type { IncomingMessage, ServerResponse } from 'node:http';
import { createApp } from '../dist/create-app';

type Handler = (req: IncomingMessage, res: ServerResponse) => void;

let cached: Promise<Handler> | undefined;

function build(): Promise<Handler> {
  return createApp().then(async (app) => {
    await app.init();
    return app.getHttpAdapter().getInstance() as Handler;
  });
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  cached ??= build();
  const app = await cached;
  app(req, res);
}
