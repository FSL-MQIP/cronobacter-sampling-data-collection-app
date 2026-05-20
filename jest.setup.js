import { jest as jestGlobal } from '@jest/globals';

global.jest = jestGlobal;

if (typeof global.structuredClone === 'undefined') {
  global.structuredClone = (obj) => JSON.parse(JSON.stringify(obj));
}
