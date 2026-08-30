Feature: Generate a premium article image package
  The Image Agent generates selected assets sequentially so completed images
  remain inserted when a later asset fails.

  @owner-playwright-premium
  Scenario: An article package is inserted into the editor
    Given an article contains paragraphs that need contextual images
    And the deterministic image provider supports generation
    When the editor runs the Image Agent
    Then KaiGen creates the planned featured image
    And KaiGen inserts the planned body images at their paragraph anchors
    And progress reaches Done

  @owner-premium-unit
  Scenario: Each completed asset is inserted before the next generation
    Given the Image Agent planned multiple selected assets
    When the image provider completes each asset
    Then KaiGen inserts each completed asset before requesting the next one

  @owner-premium-unit
  Scenario: A later ordinary failure preserves completed assets
    Given the Image Agent already inserted an earlier asset
    And a later asset fails with a non-rate-limit error
    When package generation continues
    Then the earlier asset remains inserted
    And the failed asset is counted as failed
    And remaining planned assets may still be generated

  @owner-premium-unit
  Scenario: Provider rotation avoids duplicate insertion
    Given multiple image providers are configured
    And the first provider rate limits an asset
    When another provider completes the same asset
    Then KaiGen inserts that asset exactly once
    And KaiGen does not wait before trying the next provider

  @owner-premium-unit
  Scenario: Exhausted rate-limit retries stop the package
    Given every provider rate limits an asset
    When the Image Agent exhausts its retry delays
    Then the current asset is counted as failed
    And no later asset is requested
    And assets inserted before the rate limit remain inserted
    And the result reports that generation was rate limited
