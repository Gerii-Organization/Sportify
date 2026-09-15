import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import ro from '../src/i18n/ro.js';

// Babel is a dependency of the app already; loaded through require so the test
// needs nothing new.
const require = createRequire(import.meta.url);
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

function sourceFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'i18n' ? [] : sourceFiles(full);
    return entry.name.endsWith('.js') ? [full] : [];
  });
}

/** Every string the app's source could pass to t(), constant-folded. */
function allStrings() {
  const found = new Set();
  for (const file of [...sourceFiles('src'), 'App.js']) {
    const ast = parser.parse(fs.readFileSync(file, 'utf8'), { sourceType: 'module', plugins: ['jsx'] });
    traverse(ast, {
      StringLiteral(p) { found.add(p.node.value); },
      BinaryExpression(p) {
        const result = p.evaluate();
        if (result.confident && typeof result.value === 'string') found.add(result.value);
      },
      TemplateLiteral(p) {
        if (!p.node.expressions.length) found.add(p.node.quasis.map((q) => q.value.cooked).join(''));
      },
    });
  }
  return found;
}

test('every Romanian entry translates text that exists in the app', () => {
  // A key that matches nothing is a typo or a string that has since changed:
  // either way the screen shows English and nobody notices.
  const strings = allStrings();
  const orphans = Object.keys(ro).filter((key) => !strings.has(key));
  assert.deepEqual(orphans, [], `ro.js keys with no matching source text:\n${orphans.join('\n')}`);
});

test('translations keep their placeholders', () => {
  const placeholders = (text) => (String(text).match(/\{\w+\}/g) || []).sort().join(',');
  for (const [key, value] of Object.entries(ro)) {
    const forms = typeof value === 'string' ? [value] : Object.values(value);
    for (const form of forms) {
      assert.equal(placeholders(form), placeholders(key), `placeholder mismatch for "${key}"`);
    }
  }
});
