import "dotenv/config";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createWorkflowStore } from "./workflows/fileStore.js";

const config = loadConfig();
const store = createWorkflowStore(config);
const { server } = createApp({ config, store });

server.listen(config.port, () => {
  console.log(`AI SDE workflow service listening on http://localhost:${config.port}`);
});
