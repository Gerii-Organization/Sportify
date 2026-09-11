/**
 * Lets Node resolve the extensionless imports the app is written with.
 *
 * `import { MUSCLES } from '../constants/exercises'` is what Metro expects and
 * what all 85 files use. Node's ESM resolver requires the `.js`. Rather than
 * rewrite every import in the app to suit the test runner — the tail wagging
 * the dog, and a diff touching files with no other reason to change — this
 * hook retries a failed relative resolve with `.js` appended.
 */
export async function resolve(specifier, context, next) {
  try {
    return await next(specifier, context);
  } catch (error) {
    if (error?.code !== 'ERR_MODULE_NOT_FOUND') throw error;
    if (!specifier.startsWith('.')) throw error;
    return next(`${specifier}.js`, context);
  }
}
