import { createApp } from "./app.js";

export default {
  fetch(request, env, context) {
    return createApp(env).fetch(request, env, context);
  },
};
