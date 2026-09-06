# KaiGen acceptance specifications

The feature files in this directory describe behavior that KaiGen owns. They
are a human-reviewed contract, not an alternate implementation and not a
substitute for executable tests.

Each scenario has exactly one `@owner-*` tag. The owner is the narrowest suite
that must prove the scenario. Broader suites may repeat important paths, but a
failure always has one primary home.

| Owner tag | Executable layer | Intended command or location |
| --- | --- | --- |
| `@owner-js-unit` | JavaScript behavior | Root Jest suite in `tests/unit/` |
| `@owner-php-unit` | PHP policy or boundary behavior | PHPUnit suite in `tests/php/` |
| `@owner-playwright-generation` | Assembled generation workflow | Mocked-generation Playwright suite |
| `@owner-playwright-reference` | Assembled reference-media workflow | Reference-media Playwright suite |
| `@owner-ci-pr` | Pull-request gate composition | Repository CI workflow checks |
| `@owner-mutation` | Strength of critical policy tests | Scoped mutation suite |

The dependency direction is deliberate:

1. JavaScript and PHP unit tests execute KaiGen policy without a browser.
2. Boundary tests use deterministic WordPress AI Client and REST result fakes.
3. Playwright runs the assembled plugin in WordPress Playground and verifies
   editor and Media Library state.
4. CI, coverage, and mutation checks measure whether those suites remain
   intentional and effective.

Fast and deterministic suites must not call a paid or live provider. Provider
fakes model only the WordPress AI Client shapes KaiGen consumes; they do not
reimplement provider internals.

## Traceability

When behavior changes, update the feature scenario and its owning executable
test together. A scenario without exactly one owner is incomplete.

## Scope

These specifications cover image generation, reference images, and WordPress
media persistence in the base plugin.
