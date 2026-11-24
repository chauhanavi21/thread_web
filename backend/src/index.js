import { app } from './app.js';
import { seedIfEmpty } from './seed.js';
import { ensureAdmin } from './bootstrapAdmin.js';
import { startPickupExpiry } from './pickup.js';

const PORT = Number(process.env.PORT) || 4000;

const added = seedIfEmpty();
if (added) console.log(`Added ${added} products to the catalog.`);
await ensureAdmin();
startPickupExpiry();

app.listen(PORT, () => console.log(`Threads API listening on http://localhost:${PORT}`));
