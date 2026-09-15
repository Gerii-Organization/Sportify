// Translated strings are asserted in English whatever the machine's locale.
process.env.SPORTIFY_LANGUAGE = 'en';
import { register } from 'node:module';

register('./extensionless-hook.mjs', import.meta.url);
