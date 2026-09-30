#!/usr/bin/env node
/**
 * Static checks that catch the bugs this codebase has actually shipped, none of
 * which a plain parse or the bundler reports:
 *
 *   · undefined identifiers           a typo'd variable is a red screen at runtime
 *   · unused imports                  and imports of names that no longer exist
 *   · lucide icons that do not exist  they bundle fine and crash on render
 *   · duplicate JSX attributes        the second silently wins
 *   · `const x = x(...)`              a local shadowing the function it calls
 *   · reads before declaration        Babel turns const into var, so these read
 *                                     `undefined` instead of throwing — a hook's
 *                                     dependency array is evaluated during render
 *
 * Run with `npm run check`. Exits non-zero on any finding.
 */
const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

const ROOT = path.join(__dirname, '..');

const GLOBALS = new Set(`console require module exports __DEV__ setTimeout clearTimeout setInterval clearInterval
Promise JSON Math Date Object Array Number String Boolean Error TypeError RangeError Map Set WeakMap WeakSet Symbol
parseInt parseFloat isNaN isFinite fetch FormData URL URLSearchParams encodeURIComponent decodeURIComponent global
globalThis process undefined NaN Infinity RegExp requestAnimationFrame cancelAnimationFrame alert atob btoa Intl
Buffer TextEncoder TextDecoder AbortController queueMicrotask structuredClone Blob FileReader performance Uint8Array
ArrayBuffer Reflect Proxy BigInt navigator window document crypto XMLHttpRequest WebSocket Headers Response Request
Function arguments setImmediate clearImmediate Event EventTarget`.split(/\s+/));

/** Callbacks React runs during render: a read in one of them is a read now. */
const SYNC_HOOKS = new Set(['useMemo', 'useState', 'useReducer']);

// lucide-react-native does not load under node (react-native ships Flow), so
// its export names come from its type declarations.
let lucide = null;
try {
  const dts = fs.readFileSync(path.join(ROOT, 'node_modules/lucide-react-native/dist/lucide-react-native.d.ts'), 'utf8');
  lucide = new Set();
  for (const block of dts.match(/export \{[^}]*\}/g) || []) {
    for (const part of block.slice(8, -1).split(',')) {
      const name = part.trim().split(/\s+as\s+/).pop();
      if (name) lucide.add(name);
    }
  }
  for (const m of dts.matchAll(/declare const (\w+)/g)) lucide.add(m[1]);
} catch {
  lucide = null;
}

function files(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return files(full);
    return /\.(js|jsx)$/.test(e.name) ? [full] : [];
  });
}

/** The function a path runs in, looking through callbacks React runs during render. */
function runsIn(p) {
  let fn = p.getFunctionParent();
  while (fn) {
    const call = fn.parentPath;
    const syncHook = call?.isCallExpression()
      && call.get('arguments')[0] === fn
      && call.get('callee').isIdentifier()
      && SYNC_HOOKS.has(call.node.callee.name);
    if (!syncHook) return fn;
    fn = call.getFunctionParent();
  }
  return null;
}

const targets = [...files(path.join(ROOT, 'src')), path.join(ROOT, 'App.js')];
let problems = 0;
const report = (file, line, msg) => {
  problems += 1;
  console.log(`${path.relative(ROOT, file)}:${line}  ${msg}`);
};

for (const file of targets) {
  let ast;
  try {
    ast = parser.parse(fs.readFileSync(file, 'utf8'), { sourceType: 'module', plugins: ['jsx'] });
  } catch (e) {
    report(file, e.loc?.line ?? '?', `parse error: ${e.message}`);
    continue;
  }

  traverse(ast, {
    Program(p) {
      for (const [name, refs] of Object.entries(p.scope.globals)) {
        if (!GLOBALS.has(name)) report(file, refs.loc?.start.line ?? '?', `undefined identifier: ${name}`);
      }
      for (const [name, binding] of Object.entries(p.scope.bindings)) {
        if (binding.kind === 'module' && !binding.referenced) {
          report(file, binding.path.node.loc.start.line, `unused import: ${name}`);
        }
      }
    },

    ImportDeclaration(p) {
      if (p.node.source.value !== 'lucide-react-native' || !lucide) return;
      for (const s of p.node.specifiers) {
        if (s.type === 'ImportSpecifier' && !lucide.has(s.imported.name)) {
          report(file, s.loc.start.line, `lucide has no export ${s.imported.name}`);
        }
      }
    },

    JSXOpeningElement(p) {
      const seen = new Set();
      for (const a of p.node.attributes) {
        if (a.type !== 'JSXAttribute') continue;
        const n = a.name.name;
        if (seen.has(n)) report(file, a.loc.start.line, `duplicate JSX attribute ${n}`);
        seen.add(n);
      }
    },

    VariableDeclarator(p) {
      const decl = p.parentPath;

      // const x = x(...)
      if (p.node.id.type === 'Identifier' && p.node.init) {
        const name = p.node.id.name;
        p.get('init').traverse({
          Function(inner) { inner.skip(); },
          Identifier(id) {
            if (id.node.name === name && id.isReferencedIdentifier()) {
              report(file, id.node.loc.start.line, `self-reference in initializer of ${name}`);
            }
          },
        });
      }

      // Read before declaration.
      if (!decl.isVariableDeclaration() || decl.node.kind === 'var') return;
      const home = runsIn(p);
      // `export const x` counts the export itself as a reference, placed just
      // before the declarator: anything from the statement on is fine.
      const statement = decl.parentPath.isExportNamedDeclaration() ? decl.parentPath.node : decl.node;
      for (const name of Object.keys(p.getBindingIdentifiers())) {
        const binding = p.scope.getBinding(name);
        if (!binding) continue;
        for (const ref of binding.referencePaths) {
          if (ref.node.start >= statement.start) continue;
          if (runsIn(ref) !== home) continue;
          report(file, ref.node.loc.start.line, `${name} read before its declaration on line ${p.node.loc.start.line}`);
        }
      }
    },
  });
}

console.log(problems ? `${problems} problem(s) in ${targets.length} files` : `OK: ${targets.length} files`);
process.exitCode = problems ? 1 : 0;
