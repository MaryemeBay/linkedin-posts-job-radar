import { startViewer } from '../build/commands/viewer.js';

const result = await startViewer();
console.log(result.message);
