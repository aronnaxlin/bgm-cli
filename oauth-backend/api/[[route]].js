import { handle } from "hono/vercel";
import { createApp } from "../src/app.js";

const app = createApp(process.env);

export const GET = handle(app);
export const POST = handle(app);
