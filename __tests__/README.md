# Tests

`node --test` against the pure modules in `src/lib` and `src/constants`. No
Jest, no `jest-expo`, no transform step — these modules import nothing from
React Native, so Node runs them as they are.

    npm test

That boundary is the point rather than a limitation to apologise for. The logic
worth protecting here is arithmetic and rules — how a session is matched to a
split day, which sets count towards volume, what a plate load comes to, when a
superset ends — and none of it needs a renderer. Components are verified by
running the app.

Adding a test file: name it `<module>.test.mjs`. `.mjs` because the package is
CommonJS; the modules under test are ES modules that Node detects by syntax.
