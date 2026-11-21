import assert from 'node:assert/strict';
import { Script } from 'node:vm';
import { page } from '../source/page.js';

assert.match(page, /<html lang="sl">/);
assert.match(page, /href="\.\/"/);
assert.match(page, /\.\/jobs\.json/);
assert.match(page, /function configureMulti\(/);
assert.match(page, /function persistFilters\(/);

const script = page.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script, 'Predloga mora vsebovati odjemalsko skripto');
new Script(script, { filename: 'deloradar-client.js' });

await import('../source/collector.js');
console.log('OK: predloga, odjemalski JS in zbiralnik');
