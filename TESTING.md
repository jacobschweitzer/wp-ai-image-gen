# Base Plugin Test Strategy

KaiGen uses independent verification layers so a change cannot pass merely by
matching one set of mocks. This document covers the free plugin only. Credits,
billing, Stripe, premium providers, and premium account state belong to the
premium plugin and are intentionally excluded.

## Verification layers

| Layer                 | Real behavior proved by the initial test                               | Command                                                                          | CI                    |
| --------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------- | --------------------- |
| PHP unit              | Missing prompts and unavailable AI Client behavior                     | `npm run test:php`                                                               | Tests                 |
| PHP behavioral        | Retry hooks, timeout boundaries, and cURL safeguards                   | `npm run test:php`                                                               | Tests                 |
| JavaScript unit       | REST payload and response normalization                                | `npm run test:unit`                                                              | Tests                 |
| Rendered JavaScript   | A user types and submits a prompt, then previews generated media       | `npm run test:unit`                                                              | Tests                 |
| REST integration      | Real WordPress rejects an anonymous providers request                  | `npm run test:e2e:base`                                                          | E2E Tests             |
| Acceptance/E2E        | A real editor inserts a deterministic generated attachment             | `npm run test:e2e:generation`                                                    | E2E Tests             |
| Negative E2E          | A provider failure remains visible and leaves the block unchanged      | `npm run test:e2e:generation`                                                    | E2E Tests             |
| AI Client contract    | KaiGen builds a request through the unfaked WordPress 7.0 AI Client    | `npm run test:e2e:contract`                                                      | E2E Tests             |
| PHP coverage          | The critical retry-options implementation remains at least 95% covered | `npm run test:php:coverage`                                                      | Tests                 |
| JavaScript coverage   | Global and risk-selected module thresholds remain satisfied            | `npm run test:unit:coverage`                                                     | Tests                 |
| PHP mutation          | Infection mutates the production retry-options class                   | `npm run test:php:mutation`                                                      | Mutation Quality      |
| JavaScript mutation   | Stryker mutates API and availability decisions                         | `npm run test:mutation:js`                                                       | Mutation Quality      |
| Static analysis       | PHPStan level 5 analyzes every production PHP entrypoint               | `npm run test:php:static`                                                        | Tests                 |
| Complexity            | PHPMD prevents production PHP from exceeding the recorded ceilings     | `npm run test:php:complexity`                                                    | Tests                 |
| Runtime compatibility | The editor and real AI Client run on WordPress 7.0 with PHP 7.4        | `PLAYGROUND_WP_VERSION=7.0 PLAYGROUND_PHP_VERSION=7.4 npm run test:e2e:contract` | Runtime Compatibility |

The weekly compatibility workflow also checks rolling WordPress latest and
nightly builds. Nightly is advisory because upstream development versions can
break temporarily; the declared minimum runtime remains a pull-request gate.

## Mutation scope

Mutation testing starts with small, behaviorally covered production surfaces.
Expanding a mutation target before adding behavioral coverage creates noise and
slow builds rather than confidence. Infection currently owns HTTP retry policy;
Stryker owns REST request construction and editor availability decisions. Add a
new target only after a real test exercises its success and failure branches.

## Local prerequisites

- PHP coverage and Infection require Xdebug. CI installs it automatically.
- Infection is isolated under `tools/infection` because its PHP requirement is
  newer than KaiGen's runtime requirement.
- Browser tests install their dependencies from `tests/e2e/package-lock.json`.
