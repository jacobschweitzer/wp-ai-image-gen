Feature: Refine an image prompt interactively
  Editors can request visual alternatives and apply one without allowing stale
  asynchronous results to replace newer prompt text.

  @owner-playwright-generation
  Scenario: Interactive mode applies a refinement choice
    Given the editor entered an image prompt
    And the deterministic text provider returns refinement choices
    When the editor opens Interactive mode and selects a choice
    Then KaiGen replaces the prompt with the applied prompt
    And KaiGen refreshes choices for the updated prompt

  @owner-js-unit
  Scenario: Empty prompts do not request refinements
    Given the prompt is empty or whitespace
    When the editor requests refinement choices
    Then KaiGen returns no choices
    And no refinement request is sent

  @owner-js-unit
  Scenario: Stale refinement choices cannot replace current choices
    Given a refinement request is pending for an earlier prompt
    And the editor changes the prompt and requests new choices
    When the earlier request finishes after the newer request
    Then KaiGen shows only choices for the current prompt

  @owner-js-unit
  Scenario: Stale applied text cannot replace a newer prompt
    Given applying a refinement choice is pending
    When the editor changes the prompt before the application finishes
    Then the editor keeps the newer prompt

  @owner-js-unit
  Scenario: Refinement application falls back locally
    Given the text provider cannot apply a selected refinement
    When KaiGen applies the choice
    Then KaiGen replaces the selected term locally
    And the editor retains a usable prompt

  @owner-php-unit
  Scenario: Malformed refinement JSON returns a stable error
    Given the WordPress AI Client returns malformed refinement JSON
    When KaiGen handles the refinement response
    Then KaiGen returns a stable prompt refinement error
    And no malformed choice is exposed to the editor

  @owner-php-unit @AE4
  Scenario: Prompt refinement requires media upload permission
    Given the current WordPress user cannot upload files
    When the user requests prompt refinements
    Then KaiGen denies the request before calling the text provider
