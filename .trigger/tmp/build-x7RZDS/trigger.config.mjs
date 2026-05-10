import {
  defineConfig
} from "./chunk-4U6U2DH6.mjs";
import "./chunk-TTPJKBBL.mjs";
import "./chunk-OZGKWJ76.mjs";
import "./chunk-6V3XLBYD.mjs";
import "./chunk-4MZOQUDI.mjs";
import {
  init_esm
} from "./chunk-KXY2ZOOA.mjs";

// trigger.config.ts
init_esm();
try {
  process.loadEnvFile(".env.local");
} catch {
}
var projectRef = process.env.TRIGGER_PROJECT_REF;
if (!projectRef) {
  throw new Error(
    "TRIGGER_PROJECT_REF nao definida. Crie project em cloud.trigger.dev e adicione no .env.local"
  );
}
var trigger_config_default = defineConfig({
  project: projectRef,
  runtime: "node",
  logLevel: "log",
  // 5min default por run; cada task pode override
  maxDuration: 300,
  retries: {
    enabledInDev: false,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1e3,
      maxTimeoutInMs: 3e4,
      factor: 2,
      randomize: true
    }
  },
  dirs: ["./src/lib/trigger/tasks"],
  build: {}
});
var resolveEnvVars = void 0;
export {
  trigger_config_default as default,
  resolveEnvVars
};
//# sourceMappingURL=trigger.config.mjs.map
