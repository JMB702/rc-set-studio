// Every /api/* request lands here (see vercel.json) and runs the same Worker that `npm start` runs locally.
// Static files in public/ are served by Vercel's CDN and never reach this function.
import worker from '../dist/server/index.js';
import {database} from './_d1.mjs';

export default {
  async fetch(request) {
    let DB;
    try {DB = await database();} catch (error) {console.error('Database unavailable', error);}
    return worker.fetch(request, {DB, PROJECT_TRANSFER_SECRET: process.env.PROJECT_TRANSFER_SECRET});
  },
};
