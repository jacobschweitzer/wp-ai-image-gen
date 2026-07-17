# TODO

## KaiGen Premium extraction

- Move `premium/kaigen-premium/` into its own repository and distributable
  WordPress plugin once the add-on boundary is stable.
- Decide whether KaiGen core should expose a documented JavaScript API wrapper
  for add-ons. The premium prototype currently owns a small wrapper around
  `/kaigen/v1/generate-image` so it does not import private core source files.
- Define the supported compatibility contract between KaiGen and KaiGen
  Premium, including the minimum core version, REST response shape, editor
  settings, activation behavior, and release coordination.
- Implement the model-backed planning and review workflow described in the
  premium plugin's `docs/plans/` directory.
