import { Router } from 'express';
import { inventoryEvents, inventoryVersion } from '../inventoryEvents.js';

const router = Router();
router.get('/events', (req, res) => {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.flushHeaders();
  const send = (version) => {
    if (!res.destroyed && !res.writableEnded) res.write(`event: inventory\ndata: ${JSON.stringify({ version })}\n\n`);
  };
  inventoryEvents.on('change', send);
  send(inventoryVersion());
  const heartbeat = setInterval(() => { if (!res.destroyed) res.write(': keep-alive\n\n'); }, 25000);
  heartbeat.unref();
  const cleanup = () => { clearInterval(heartbeat); inventoryEvents.off('change', send); };
  req.once('close', cleanup);
  res.once('error', cleanup);
});
export default router;
