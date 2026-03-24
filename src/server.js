import { initDatabase } from "./db/database.js";
import { seedOpeningHoursIfEmpty } from "./repositories/scheduleRepository.js";
import { createApp } from "./app.js";
import { config } from "./config/env.js";

initDatabase();
seedOpeningHoursIfEmpty();

const app = createApp();

app.listen(config.port, () => {
  console.log(`Listening on http://localhost:${config.port}`);
});
