# Base Plugin Testing Backlog

This backlog covers the free KaiGen WordPress plugin only. Premium concerns such
as credits, billing, Stripe, premium providers, and premium account state belong
in the premium plugin's separate test strategy and CI.

PR #59 establishes deterministic WordPress Playground scenarios for the base
editor, reference-media behavior, and mocked image generation. GitHub CI also
enforces the existing PHP tests, JavaScript unit tests, E2E launcher tests, and
production build. The tasks below are the remaining work needed to make the
base-plugin safety net substantially stronger.

## P1: Behavioral PHP coverage

- [ ] Test prompt, provider, and orientation construction with behavioral fakes,
      including automatic and explicit provider selection.
- [ ] Test unsupported image generation and malformed or missing AI Client
      results.
- [ ] Test timeout detection, one-time retry behavior, and cleanup of every
      temporary HTTP filter after success, errors, and exceptions.
- [ ] Test reference-image rejection for unauthorized, missing, and invalid
      attachment IDs.
- [ ] Replace or supplement source-text assertions with tests that execute the
      relevant service behavior.

## P1: REST API and media handling

- [ ] Test REST permission failures for users without `upload_files` and without
      access to a selected reference attachment.
- [ ] Test request schema validation and sanitization for prompts, providers,
      orientations, and reference attachment IDs.
- [ ] Test provider discovery, provider reference-image limits, and empty or
      unavailable provider registries.
- [ ] Test image ingestion from supported data URIs, raw data, and remote URLs.
- [ ] Test invalid base64, unsupported MIME types, temporary-file failures, and
      temporary-file cleanup.
- [ ] Test generated filenames, attachment metadata, alt text, and provider/model
      metadata.

## P2: JavaScript behavior

- [ ] Replace or supplement source-inspection tests with rendered component and
      interaction tests.
- [ ] Test loading, error, retry, and duplicate-submit states in the generation
      modal.
- [ ] Test provider-specific reference limits and selection changes.
- [ ] Test generated-image preview, regeneration, and insertion behavior through
      the editor data store.
- [ ] Test API error normalization and malformed successful responses.

## P2: Negative end-to-end scenarios

- [ ] Add an unsupported or unavailable provider scenario.
- [ ] Add deterministic generation error and timeout scenarios.
- [ ] Add forbidden and missing reference-image scenarios.
- [ ] Add explicit-provider and non-square orientation scenarios.
- [ ] Add duplicate-click and browser-refresh scenarios to prove that the editor
      remains consistent.
- [ ] Assert that no unexpected browser console errors occur in each critical
      workflow.

## P2: AI Client compatibility

- [ ] Add a separate compatibility test against the supported real WordPress AI
      Client API so upstream contract drift cannot be hidden by KaiGen's fake.
- [ ] Keep live or version-matrix compatibility checks separate from the fast,
      deterministic pull-request suite.

## P3: Quality signals

- [ ] Add a supported WordPress and PHP version compatibility matrix that is
      separate from the development toolchain runtime.
- [ ] Publish PHP and JavaScript coverage reports and define risk-based minimums.
- [ ] Introduce focused mutation testing for request construction, permissions,
      retries, and media handling.
- [ ] Add PHP static analysis and enforce an agreed baseline in CI.
- [ ] Periodically audit tests that only inspect source text and convert important
      contracts to behavioral tests.

## Completion standard

A backlog item is complete only when its test fails for the intended regression,
passes after the implementation is correct, runs in the appropriate GitHub CI
workflow, and contains no premium-plugin assumptions.
