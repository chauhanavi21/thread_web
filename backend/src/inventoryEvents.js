import { EventEmitter } from 'node:events';

export const inventoryEvents = new EventEmitter();
inventoryEvents.setMaxListeners(100);
let version = 0;
export const inventoryVersion = () => version;
export function notifyInventoryChanged() {
  version += 1;
  inventoryEvents.emit('change', version);
}
