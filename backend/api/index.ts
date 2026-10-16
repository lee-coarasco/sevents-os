import type { IncomingMessage, ServerResponse } from "node:http";
import { buildApp } from "../src/app.js";

const app = buildApp();
let isReady = false;

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (!isReady) {
    await app.ready();
    isReady = true;
  }
  app.server.emit("request", req, res);
}
