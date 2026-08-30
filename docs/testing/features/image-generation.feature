Feature: Generate an image in the block editor
  Editors can generate an image through the WordPress AI Client and keep the
  resulting attachment in the image block and Media Library.

  @owner-playwright-generation @AE1
  Scenario: A generated attachment becomes the image block media
    Given an empty Image block and a supported deterministic image provider
    When the editor generates an image from a valid prompt
    Then KaiGen sends exactly one generation request
    And the returned attachment ID and URL are stored on the Image block
    And the attachment exists in the Media Library

  @owner-playwright-generation @AE2
  Scenario: An editor can retry after provider failure
    Given the deterministic image provider will reject the next request
    And the editor has entered a prompt
    When image generation fails
    Then KaiGen announces the provider error
    And the modal keeps the prompt
    And image generation becomes available again
    When the provider is configured to succeed and the editor retries
    Then the generated attachment is inserted

  @owner-js-unit @AE3
  Scenario: An active generation is single flight
    Given image generation is still pending
    When the editor repeatedly clicks Generate Image and presses Enter
    Then KaiGen sends only one generation request
    And KaiGen inserts at most one returned image

  @owner-php-unit @AE4
  Scenario: Image generation requires media upload permission
    Given the current WordPress user cannot upload files
    When the user requests image generation
    Then KaiGen denies the request before calling the image provider

  @owner-php-unit @AE6
  Scenario: A timeout-like provider failure receives one isolated retry
    Given the first image provider call fails with a timeout-like error
    When KaiGen retries the generation
    Then lower-level HTTP timeout options apply only to the retry
    And the temporary HTTP hooks are removed after the retry finishes

  @owner-php-unit @AE7
  Scenario: A non-timeout provider failure is not retried
    Given the image provider returns a non-timeout failure
    When KaiGen handles the failure
    Then KaiGen returns a stable generation error
    And the image provider was called only once

  @owner-php-unit @AE8
  Scenario Outline: Supported AI Client image results are normalized
    Given the WordPress AI Client returns an image using <result_shape>
    When KaiGen extracts the generated image
    Then the image is passed to the Media Library boundary

    Examples:
      | result_shape        |
      | snake-case data URI |
      | camel-case data URI |
      | snake-case data     |
      | camel-case data     |
      | snake-case URL      |
      | camel-case URL      |

  @owner-php-unit @AE8
  Scenario Outline: Unsupported AI Client image results fail stably
    Given the WordPress AI Client returns <result_shape>
    When KaiGen extracts the generated image
    Then KaiGen returns the <error_code> error
    And no Media Library attachment is created

    Examples:
      | result_shape            | error_code               |
      | no image file           | missing_image_result      |
      | an unsupported file API | unsupported_image_result  |

  @owner-ci-pr @AE9
  Scenario: Pull requests run every intentional verification ring
    Given a change is proposed to KaiGen
    When pull-request verification runs
    Then root JavaScript, PHP, launcher, and premium unit suites run
    And every deterministic Playwright suite runs
    And committed build parity is checked

  @owner-mutation @AE10
  Scenario: Critical image-generation policy is constrained by behavior
    Given a conditional in retry, permission, or result normalization policy is mutated
    When the scoped mutation suite runs
    Then at least one owning behavioral test fails
