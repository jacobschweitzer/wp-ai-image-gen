Feature: Use Media Library images as generation references
  Editors can mark attachments as references and send only authorized,
  existing attachments with an image-generation request.

  @owner-playwright-reference
  Scenario: Reference-image marking persists in WordPress
    Given an image attachment is selected in the block editor
    When the editor marks it as a Reference image
    Then its KaiGen reference metadata is enabled
    And it appears in the KaiGen reference image list
    When the editor unmarks it
    Then its KaiGen reference metadata is disabled
    And it no longer appears in the KaiGen reference image list

  @owner-js-unit
  Scenario: Selected reference IDs use the REST request contract
    Given the editor selected marked reference attachments
    When the editor generates an image
    Then their numeric IDs are sent as source_image_ids
    And the selected provider and orientation are sent with the prompt

  @owner-js-unit
  Scenario: Reference selection obeys the provider limit
    Given a provider exposes a reference image limit
    When the editor selects reference images
    Then KaiGen accepts no more than that provider's limit
    When the editor changes to a provider with a lower limit
    Then KaiGen keeps only the allowed number of selected references

  @owner-php-unit @AE5
  Scenario: A forbidden reference never reaches the provider
    Given a reference attachment exists
    And the current user cannot edit that attachment
    When the user requests generation with its attachment ID
    Then KaiGen returns forbidden_reference_file
    And the image provider is not called

  @owner-php-unit
  Scenario: A missing reference file never reaches the provider
    Given a reference attachment ID has no file on disk
    When the user requests generation with its attachment ID
    Then KaiGen returns missing_reference_file
    And the image provider is not called

  @owner-playwright-generation
  Scenario: Generated media can seed the next generation
    Given KaiGen has generated an attachment with a Media Library ID
    When the generated attachment is shown in the modal
    Then it is selected as a reference image
    And a later generation request can include its attachment ID
