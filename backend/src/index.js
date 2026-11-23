import { app } from './app.js';
import { seedIfEmpty } from './seed.js';
import { ensureAdmin } from './bootstrapAdmin.js';

const PORT = Number(process.env.PORT) || 4000;

const added = seedIfEmpty();
if (added) console.log(`Added ${added} products to the catalog.`);
await ensureAdmin();

app.listen(PORT, () => console.log(`Threads API listening on http://localhost:${PORT}`));
