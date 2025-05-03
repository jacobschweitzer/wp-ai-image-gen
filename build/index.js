/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./src/api.js":
/*!********************!*\
  !*** ./src/api.js ***!
  \********************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   fetchProviders: () => (/* binding */ fetchProviders),
/* harmony export */   generateImage: () => (/* binding */ generateImage)
/* harmony export */ });
// This file provides API functions for fetching available providers and generating AI images.

/**
 * Fetches available providers from the server.
 *
 * @returns {Promise<Object>} A promise that resolves to an object containing provider IDs and names.
 */
const fetchProviders = async () => {
  // This function fetches providers using WordPress API.
  try {
    // Attempt to fetch providers using wp.apiFetch.
    const response = await wp.apiFetch({
      path: '/wp-ai-image-gen/v1/providers'
    });
    return response; // Return the successful response.
  } catch (error) {
    // Log any errors that occur during fetch.
    console.error('Error fetching providers:', error);
    // Return an object with an error field to indicate failure.
    return {
      error: 'Unable to fetch providers. Please try again later.'
    };
  }
};

/**
 * Generates an AI image based on the given prompt, provider, and optional parameters.
 *
 * @param {string} prompt - The text prompt for image generation.
 * @param {string} provider - The selected provider ID.
 * @param {function} callback - The callback function to handle the generated image data.
 * @param {Object} [options] - Optional parameters for image generation.
 * @param {string} [options.sourceImageUrl] - URL of the source image for image-to-image generation.
 * @param {string[]} [options.additionalImageUrls] - Array of additional source image URLs (for GPT Image-1 only).
 * @param {string} [options.maskUrl] - URL of mask image for inpainting (for GPT Image-1 only).
 * @param {string} [options.moderation] - Moderation level: 'auto' or 'low' (for GPT Image-1 only).
 * @param {string} [options.style] - Style parameter: 'natural' or 'vivid' (for GPT Image-1 only).
 * @returns {Promise<void>} A promise that resolves when the image generation is complete.
 */
const generateImage = async (prompt, provider, callback, options = {}) => {
  try {
    const data = {
      prompt,
      provider
    };

    // Add source image URL if provided
    if (options.sourceImageUrl) {
      data.source_image_url = options.sourceImageUrl;
    }

    // Add array of additional image URLs if provided
    if (options.additionalImageUrls && Array.isArray(options.additionalImageUrls)) {
      data.additional_image_urls = options.additionalImageUrls;
    }

    // Add mask URL if provided for inpainting
    if (options.maskUrl) {
      data.mask_url = options.maskUrl;
    }

    // Add moderation level if provided
    if (options.moderation && ['auto', 'low'].includes(options.moderation)) {
      data.moderation = options.moderation;
    }

    // Add style if provided
    if (options.style && ['natural', 'vivid'].includes(options.style)) {
      data.style = options.style;
    }
    const response = await wp.apiFetch({
      path: '/wp-ai-image-gen/v1/generate-image',
      method: 'POST',
      data: data
    });

    // Handle WP_Error responses which come back as objects with 'code' and 'message' properties
    if (response.code && response.message) {
      // Special handling for content moderation errors
      if (response.code === 'content_moderation') {
        throw new Error(response.message);
      }
      // Handle other specific error codes as needed
      if (response.code === 'replicate_error') {
        throw new Error('Image generation failed: ' + response.message);
      }
      // Generic error handling for other WP_Error responses
      throw new Error(response.message);
    }

    // Handle successful response with URL
    if (response && response.url) {
      // Check if we have a valid WordPress media ID (a number greater than 0)
      if (response.id && typeof response.id === 'number' && response.id > 0) {
        // This is a WordPress media library attachment with a valid ID
        callback({
          url: response.url,
          alt: prompt,
          id: response.id,
          // Use the actual WordPress media ID
          caption: ''
        });
      } else {
        // This is just a URL with no valid WordPress media ID
        // Create an object without an ID to prevent 404 errors
        callback({
          url: response.url,
          alt: prompt,
          caption: ''
          // Omit the id property completely
        });
      }
    } else {
      // Handle invalid response format
      throw new Error('Invalid response from server: ' + JSON.stringify(response));
    }
  } catch (error) {
    // Log detailed error information
    console.error('Image generation failed:', error);
    if (error.message) console.error('Error message:', error.message);
    if (error.stack) console.error('Error stack:', error.stack);

    // Pass the error back to the callback
    callback({
      error: error.message || 'An unknown error occurred while generating the image'
    });
  }
};

/***/ }),

/***/ "./src/components/AIImageToolbar.js":
/*!******************************************!*\
  !*** ./src/components/AIImageToolbar.js ***!
  \******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "react");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _wordpress_components__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @wordpress/components */ "@wordpress/components");
/* harmony import */ var _wordpress_components__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_wordpress_components__WEBPACK_IMPORTED_MODULE_1__);

// This file contains the AIImageToolbar component used in block toolbars for AI image actions.

 // Import necessary toolbar components.

/**
 * AIImageToolbar component for adding AI image generation or regeneration buttons.
 *
 * @param {Object} props - Component properties.
 * @param {boolean} props.isGenerating - Indicates if an image is currently being generated.
 * @param {Function} props.onGenerateImage - Callback to handle image generation.
 * @param {boolean} [props.isRegenerating] - Indicates if an image is being regenerated.
 * @param {Function} [props.onRegenerateImage] - Callback to handle image regeneration.
 * @param {boolean} [props.isImageBlock] - Determines if the current block is an image block.
 * @param {boolean} [props.isTextSelected] - Determines if text is selected to trigger generation.
 * @param {boolean} [props.supportsImageToImage] - Indicates if the current provider supports image-to-image generation.
 * @returns {JSX.Element|null} Returns the toolbar with the appropriate button or null if conditions are unmet.
 */
const AIImageToolbar = ({
  isGenerating,
  onGenerateImage,
  isRegenerating,
  onRegenerateImage,
  isImageBlock,
  isTextSelected,
  supportsImageToImage
}) => {
  // This functional component returns toolbar buttons based on the context of the block.
  // Render a regenerate button if the current block is an image block.
  if (isImageBlock) {
    return (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_wordpress_components__WEBPACK_IMPORTED_MODULE_1__.ToolbarGroup, null, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_wordpress_components__WEBPACK_IMPORTED_MODULE_1__.ToolbarButton, {
      icon: isRegenerating ? (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_wordpress_components__WEBPACK_IMPORTED_MODULE_1__.Spinner, null) : "update" // Show spinner when regenerating.
      ,
      label: isRegenerating ? "Regenerating AI Image..." : supportsImageToImage ? "Regenerate AI Image (using source image)" : "Regenerate AI Image" // Button label based on state.
      ,
      onClick: onRegenerateImage // Invokes the regeneration handler.
      ,
      disabled: isRegenerating // Disables the button when a regeneration is in progress.
    }));
  }
  // Render a generate button if text is selected.
  else if (isTextSelected) {
    return (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_wordpress_components__WEBPACK_IMPORTED_MODULE_1__.ToolbarGroup, null, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_wordpress_components__WEBPACK_IMPORTED_MODULE_1__.ToolbarButton, {
      icon: isGenerating ? (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_wordpress_components__WEBPACK_IMPORTED_MODULE_1__.Spinner, null) : "format-image" // Show spinner when generating.
      ,
      label: isGenerating ? "Generating AI Image..." : "Generate AI Image" // Button label based on generation status.
      ,
      onClick: onGenerateImage // Invokes the generation handler.
      ,
      disabled: isGenerating // Disables the button during generation.
    }));
  }

  // Return null if neither condition is met.
  return null;
};
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (AIImageToolbar); // Export the AIImageToolbar component.

/***/ }),

/***/ "./src/components/AITab.js":
/*!*********************************!*\
  !*** ./src/components/AITab.js ***!
  \*********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "react");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _wordpress_element__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @wordpress/element */ "@wordpress/element");
/* harmony import */ var _wordpress_element__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_wordpress_element__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var _wordpress_components__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @wordpress/components */ "@wordpress/components");
/* harmony import */ var _wordpress_components__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(_wordpress_components__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var _api__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../api */ "./src/api.js");

// This file contains the AITab React component used to generate AI images through a modal.

 // Import WordPress hooks.
 // Import necessary UI components.
 // Import API functions.

/**
 * AITab component for generating AI images.
 *
 * @param {Object} props - The properties object.
 * @param {function} props.onSelect - The callback function to handle the selected image.
 * @param {boolean} props.shouldDisplay - Flag indicating whether to render the AITab.
 * @returns {JSX.Element|null} The rendered AITab component or null if not displayed.
 */
const AITab = ({
  onSelect,
  shouldDisplay
}) => {
  // This is the AITab functional component.
  // State for modal visibility, prompt text, loading indicator, available providers, selected provider, and error message.
  const [isModalOpen, setIsModalOpen] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_1__.useState)(false); // Indicates if the modal is open.
  const [prompt, setPrompt] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_1__.useState)(''); // Stores the image prompt.
  const [isLoading, setIsLoading] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_1__.useState)(false); // Indicates if image generation is in progress.
  const [providers, setProviders] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_1__.useState)([]); // Holds available provider IDs.
  const [selectedProvider, setSelectedProvider] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_1__.useState)(''); // Tracks the selected provider.
  const [error, setError] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_1__.useState)(null); // Holds any error messages.

  // Fetch providers from the server when the component mounts.
  (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_1__.useEffect)(() => {
    const initializeProviders = async () => {
      // This async function fetches providers.
      try {
        const result = await (0,_api__WEBPACK_IMPORTED_MODULE_3__.fetchProviders)(); // Call the API to get providers.
        if (result.error) {
          setError(result.error); // Set error state if fetching failed.
          return;
        }
        setProviders(result); // Set the list of providers.

        // Retrieve the last used provider from localStorage.
        const storedProvider = localStorage.getItem('wpAiImageGenLastProvider');
        // Use the stored provider if valid, otherwise choose the first available provider.
        if (storedProvider && result.includes(storedProvider)) {
          setSelectedProvider(storedProvider);
        } else if (result.length > 0) {
          setSelectedProvider(result[0]);
          localStorage.setItem('wpAiImageGenLastProvider', result[0]); // Save the default provider.
        }
      } catch (err) {
        setError('Failed to fetch providers: ' + err.message); // Set error if provider fetching fails.
      }
    };
    initializeProviders(); // Invoke our initializeProviders function.
  }, []);

  // Update localStorage whenever the selected provider changes.
  (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_1__.useEffect)(() => {
    if (selectedProvider) {
      localStorage.setItem('wpAiImageGenLastProvider', selectedProvider); // Save the selected provider.
    }
  }, [selectedProvider]);

  /**
   * Handles the image generation process when the Generate button is clicked.
   *
   * @returns {void}
   */
  const handleGenerate = () => {
    // This function handles the generation of an AI image.
    // Check if the prompt is empty or consists solely of whitespace.
    if (!prompt.trim()) {
      setError('Please enter a prompt for image generation.');
      return;
    }
    // Ensure a provider is selected.
    if (!selectedProvider) {
      setError('Please select a provider for image generation.');
      return;
    }
    setIsLoading(true); // Start loading state.
    setError(null); // Clear any previous errors.

    // Call generateImage API function with the prompt and selected provider.
    (0,_api__WEBPACK_IMPORTED_MODULE_3__.generateImage)(prompt.trim(), selectedProvider, media => {
      if (media.error) {
        setError(media.error); // Set error if generation fails.
        setIsLoading(false); // End loading state.
      } else {
        onSelect(media); // Pass image media back to the parent.
        setIsLoading(false); // End loading state.
        setIsModalOpen(false); // Close the modal.
      }
    });
  };

  // Map provider IDs to objects for the SelectControl dropdown.
  const providerOptions = providers.map(id => ({
    value: id,
    label: id.charAt(0).toUpperCase() + id.slice(1) // Capitalize the first letter.
  }));

  // Do not render the component if shouldDisplay is false.
  if (!shouldDisplay) {
    return null;
  }
  return (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(react__WEBPACK_IMPORTED_MODULE_0__.Fragment, null, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "block-editor-media-placeholder__url-input-container"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_wordpress_components__WEBPACK_IMPORTED_MODULE_2__.Button, {
    variant: "secondary",
    onClick: () => setIsModalOpen(true),
    className: "components-button is-next-40px-default-size is-secondary"
  }, "Generate AI Image")), isModalOpen && (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_wordpress_components__WEBPACK_IMPORTED_MODULE_2__.Modal, {
    title: "WP AI Image Gen" // Modal title.
    ,
    onRequestClose: () => setIsModalOpen(false) // Closes the modal.
  }, error && (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("p", {
    style: {
      color: 'red'
    }
  }, error), providerOptions.length > 1 && (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_wordpress_components__WEBPACK_IMPORTED_MODULE_2__.SelectControl, {
    label: "Select Provider",
    value: selectedProvider,
    options: providerOptions,
    onChange: setSelectedProvider // Updates selected provider.
  }), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_wordpress_components__WEBPACK_IMPORTED_MODULE_2__.TextareaControl, {
    label: "Enter your image prompt",
    value: prompt,
    onChange: setPrompt // Updates the prompt state.
    ,
    rows: 4
  }), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_wordpress_components__WEBPACK_IMPORTED_MODULE_2__.Button, {
    variant: "primary" // Uses primary styling.
    ,
    onClick: handleGenerate // Initiates image generation.
    ,
    disabled: isLoading || !selectedProvider || !prompt.trim() // Disables button if conditions are not met.
  }, isLoading ? (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(react__WEBPACK_IMPORTED_MODULE_0__.Fragment, null, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_wordpress_components__WEBPACK_IMPORTED_MODULE_2__.Spinner, null), " ", "Generating...") : 'Generate Image')));
};
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (AITab); // Export the AITab component.

/***/ }),

/***/ "./src/core-image-modifications.js":
/*!*****************************************!*\
  !*** ./src/core-image-modifications.js ***!
  \*****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _api__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./api */ "./src/api.js");
/* harmony import */ var _components_AITab__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./components/AITab */ "./src/components/AITab.js");
/* harmony import */ var _components_AIImageToolbar__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./components/AIImageToolbar */ "./src/components/AIImageToolbar.js");
/* harmony import */ var _filters_registerFormatType__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./filters/registerFormatType */ "./src/filters/registerFormatType.js");
/* harmony import */ var _filters_addMediaUploadFilter__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./filters/addMediaUploadFilter */ "./src/filters/addMediaUploadFilter.js");
/* harmony import */ var _filters_addBlockEditFilter__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./filters/addBlockEditFilter */ "./src/filters/addBlockEditFilter.js");
// This is the main entry point for the AI image generation modifications.
// It imports the API functions, components, and filters so that they are registered and active.

 // Import API functions.
 // Import the AITab component.
 // Import the toolbar component.
 // Register the rich-text format type.
 // Enhance the MediaUpload component.
 // Enhance the BlockEdit (image regeneration) functionality.

/***/ }),

/***/ "./src/filters/addBlockEditFilter.js":
/*!*******************************************!*\
  !*** ./src/filters/addBlockEditFilter.js ***!
  \*******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "react");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _wordpress_hooks__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @wordpress/hooks */ "@wordpress/hooks");
/* harmony import */ var _wordpress_hooks__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_wordpress_hooks__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var _wordpress_element__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @wordpress/element */ "@wordpress/element");
/* harmony import */ var _wordpress_element__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(_wordpress_element__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var _wordpress_block_editor__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @wordpress/block-editor */ "@wordpress/block-editor");
/* harmony import */ var _wordpress_block_editor__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(_wordpress_block_editor__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var _components_AIImageToolbar__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../components/AIImageToolbar */ "./src/components/AIImageToolbar.js");
/* harmony import */ var _api__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ../api */ "./src/api.js");

// This file modifies the block editor for core/image blocks to include an AI image regeneration button.

 // Import the addFilter function.
 // Import necessary React hooks.
 // Import BlockControls for toolbar.
 // Import the AIImageToolbar component.
 // Import API functions for provider fetching and image generation.

// API endpoint for fetching providers that support image-to-image generation
const fetchImageToImageProviders = async () => {
  try {
    const response = await wp.apiFetch({
      path: '/wp-ai-image-gen/v1/image-to-image-providers'
    });
    return response;
  } catch (error) {
    console.error('Error fetching image-to-image providers:', error);
    return [];
  }
};

/**
 * Enhances the core/image block with an AI image regeneration button.
 *
 * @param {function} BlockEdit - The original BlockEdit component.
 * @returns {function} A new BlockEdit component with additional regeneration functionality.
 */
(0,_wordpress_hooks__WEBPACK_IMPORTED_MODULE_1__.addFilter)('editor.BlockEdit', 'wp-ai-image-gen/add-regenerate-button', BlockEdit => {
  // Return a new functional component that wraps the original BlockEdit.
  return props => {
    // Only modify core/image blocks.
    if (props.name !== 'core/image') {
      return (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(BlockEdit, {
        ...props
      });
    }

    // State to manage regeneration progress, provider selection, and errors.
    const [isRegenerating, setIsRegenerating] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_2__.useState)(false); // Indicates if regeneration is in progress.
    const [lastUsedProvider, setLastUsedProvider] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_2__.useState)(''); // Stores the last used provider.
    const [error, setError] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_2__.useState)(null); // Holds error messages if any.

    // State for tracking providers that support image-to-image generation
    const [imageToImageProviders, setImageToImageProviders] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_2__.useState)([]);

    // Initialize the last used provider and fetch image-to-image providers on component mount.
    (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_2__.useEffect)(() => {
      const initializeProvider = async () => {
        // Async function to initialize provider.
        try {
          const storedProvider = localStorage.getItem('wpAiImageGenLastProvider');
          if (storedProvider) {
            // Verify that the stored provider is still available.
            const availableProviders = await (0,_api__WEBPACK_IMPORTED_MODULE_5__.fetchProviders)();
            if (!availableProviders.error && availableProviders.includes(storedProvider)) {
              setLastUsedProvider(storedProvider);
              return;
            }
          }
          // If no valid provider was stored, fetch and use the first available provider.
          const result = await (0,_api__WEBPACK_IMPORTED_MODULE_5__.fetchProviders)();
          if (!result.error && result.length > 0) {
            const defaultProvider = result[0];
            setLastUsedProvider(defaultProvider);
            localStorage.setItem('wpAiImageGenLastProvider', defaultProvider);
          }
        } catch (err) {
          // Log an error and display a notice if initialization fails.
          console.error('Failed to initialize provider:', err);
          wp.data.dispatch('core/notices').createErrorNotice('Failed to initialize AI provider. Please try again.', {
            type: 'snackbar'
          });
        }
      };

      // Fetch providers that support image-to-image generation
      const fetchi2iProviders = async () => {
        try {
          const providers = await fetchImageToImageProviders();
          setImageToImageProviders(providers);
        } catch (err) {
          console.error('Failed to fetch image-to-image providers:', err);
        }
      };
      initializeProvider(); // Run provider initialization.
      fetchi2iProviders(); // Fetch image-to-image providers.
    }, []);

    /**
     * Handles the AI image regeneration process for the current image block.
     *
     * @returns {Promise<void>} A promise that resolves when regeneration is complete.
     */
    const handleRegenerateImage = async () => {
      // This function regenerates the image.
      setError(null); // Clear any previous errors.

      // Validate that there is alt text available to use as a prompt.
      if (!props.attributes.alt || props.attributes.alt.trim() === '') {
        wp.data.dispatch('core/notices').createErrorNotice('Please provide alt text to use as the image generation prompt.', {
          type: 'snackbar'
        });
        return;
      }

      // Ensure there is a valid provider in use.
      if (!lastUsedProvider) {
        try {
          const providers = await (0,_api__WEBPACK_IMPORTED_MODULE_5__.fetchProviders)(); // Fetch providers if necessary.
          if (providers.error || providers.length === 0) {
            wp.data.dispatch('core/notices').createErrorNotice('No AI provider available. Please check your settings.', {
              type: 'snackbar'
            });
            return;
          }
          setLastUsedProvider(providers[0]); // Use the first provider.
        } catch (err) {
          wp.data.dispatch('core/notices').createErrorNotice('Failed to fetch AI providers. Please try again.', {
            type: 'snackbar'
          });
          return;
        }
      }
      setIsRegenerating(true); // Indicate that regeneration is starting.

      try {
        // Check if the current provider supports image-to-image generation
        const supportsImageToImage = imageToImageProviders.includes(lastUsedProvider);

        // Get the source image URL if available
        const sourceImageUrl = props.attributes.url;

        // Set up options for image generation
        const options = {};
        if (supportsImageToImage && sourceImageUrl) {
          options.sourceImageUrl = sourceImageUrl;
          console.log(`Using image-to-image generation with provider ${lastUsedProvider}`);
        } else if (supportsImageToImage) {
          console.log(`Provider ${lastUsedProvider} supports image-to-image but no source image is available`);
        }

        // Wrap the generateImage call in a promise.
        const result = await new Promise((resolve, reject) => {
          (0,_api__WEBPACK_IMPORTED_MODULE_5__.generateImage)(props.attributes.alt.trim(), lastUsedProvider, result => {
            if (result.error) {
              reject(new Error(result.error));
            } else {
              resolve(result);
            }
          }, options);
        });

        // Update the block attributes with the new image data.
        // Check if we have a valid WordPress attachment ID
        if (result.id && typeof result.id === 'number' && result.id > 0) {
          // If we have a valid WP media attachment ID, use it
          props.setAttributes({
            url: result.url,
            id: result.id
          });
        } else {
          // If no ID or invalid ID, set only URL and remove ID attribute
          props.setAttributes({
            url: result.url,
            id: undefined // Removes the id attribute completely
          });
        }

        // Display a success notice on regeneration.
        wp.data.dispatch('core/notices').createSuccessNotice('Image regenerated successfully!', {
          type: 'snackbar'
        });
      } catch (err) {
        console.error('Image regeneration failed:', err); // Log the error.

        // Provide more user-friendly error messages with guidance
        let errorMessage = err.message || 'Unknown error';
        let actionGuidance = '';

        // Handle specific error cases
        if (errorMessage.includes('organization verification')) {
          actionGuidance = ' Please verify your organization in the OpenAI dashboard.';
        } else if (errorMessage.includes('parameter')) {
          errorMessage = 'API configuration error. Please contact the plugin developer.';
        } else if (errorMessage.includes('content policy')) {
          actionGuidance = ' Try a different prompt.';
        }
        wp.data.dispatch('core/notices').createErrorNotice('Failed to regenerate image: ' + errorMessage + actionGuidance, {
          type: 'snackbar'
        });
      } finally {
        setIsRegenerating(false); // Reset the regeneration state.
      }
    };
    return (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(react__WEBPACK_IMPORTED_MODULE_0__.Fragment, null, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(BlockEdit, {
      ...props
    }), " ", (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_wordpress_block_editor__WEBPACK_IMPORTED_MODULE_3__.BlockControls, null, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_components_AIImageToolbar__WEBPACK_IMPORTED_MODULE_4__["default"], {
      isRegenerating: isRegenerating,
      onRegenerateImage: handleRegenerateImage,
      isImageBlock: true // Always true for core/image blocks.
      ,
      supportsImageToImage: imageToImageProviders.includes(lastUsedProvider)
    })));
  };
});

/***/ }),

/***/ "./src/filters/addMediaUploadFilter.js":
/*!*********************************************!*\
  !*** ./src/filters/addMediaUploadFilter.js ***!
  \*********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "react");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _wordpress_hooks__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @wordpress/hooks */ "@wordpress/hooks");
/* harmony import */ var _wordpress_hooks__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_wordpress_hooks__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var _components_AITab__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../components/AITab */ "./src/components/AITab.js");

// This file enhances the MediaUpload component by adding the AITab for AI image generation.

 // Import the addFilter function.
 // Import the AITab component.

/**
 * Enhances the MediaUpload component by adding the AITab.
 *
 * @param {Object} props - Properties passed to the MediaUpload component.
 * @returns {JSX.Element} The enhanced MediaUpload component with the AITab.
 */
(0,_wordpress_hooks__WEBPACK_IMPORTED_MODULE_1__.addFilter)('editor.MediaUpload', 'wp-ai-image-gen/add-ai-tab', OriginalMediaUpload => {
  // Return a new component which wraps the original MediaUpload.
  return props => {
    // Check if the MediaUpload is used for a single image block.
    const isSingleImageBlock = props.allowedTypes && props.allowedTypes.includes('image') && !props.multiple;

    // Retrieve the currently selected block from the editor.
    const selectedBlock = wp.data.select('core/block-editor').getSelectedBlock();
    // Determine if the block is an image block.
    const isImageBlock = selectedBlock && selectedBlock.name === 'core/image';

    /**
     * Checks if the current block already has image data.
     *
     * @returns {boolean} True if the block has an image, otherwise false.
     */
    const hasImageData = () => {
      return selectedBlock && selectedBlock.attributes && selectedBlock.attributes.url;
    };

    // Only display AITab if this is a single image block without image data.
    const shouldDisplay = isSingleImageBlock && isImageBlock && !hasImageData();
    return (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(OriginalMediaUpload, {
      ...props,
      render: originalProps => (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(react__WEBPACK_IMPORTED_MODULE_0__.Fragment, null, props.render(originalProps), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_components_AITab__WEBPACK_IMPORTED_MODULE_2__["default"], {
        onSelect: props.onSelect,
        shouldDisplay: shouldDisplay
      }))
    });
  };
});

/***/ }),

/***/ "./src/filters/registerFormatType.js":
/*!*******************************************!*\
  !*** ./src/filters/registerFormatType.js ***!
  \*******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "react");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _wordpress_element__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @wordpress/element */ "@wordpress/element");
/* harmony import */ var _wordpress_element__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_wordpress_element__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var _wordpress_block_editor__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @wordpress/block-editor */ "@wordpress/block-editor");
/* harmony import */ var _wordpress_block_editor__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(_wordpress_block_editor__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var _wordpress_data__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @wordpress/data */ "@wordpress/data");
/* harmony import */ var _wordpress_data__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(_wordpress_data__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var _wordpress_rich_text__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @wordpress/rich-text */ "@wordpress/rich-text");
/* harmony import */ var _wordpress_rich_text__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(_wordpress_rich_text__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var _components_AIImageToolbar__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ../components/AIImageToolbar */ "./src/components/AIImageToolbar.js");
/* harmony import */ var _api__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ../api */ "./src/api.js");

// This file registers a new rich-text format which uses BlockControls to trigger AI image generation.

 // Import React hooks.
 // Import BlockControls from the block editor.
 // Import necessary data hooks.
 // Import registerFormatType.
 // Import the AIImageToolbar component.
 // Import API function for image generation.

/**
 * Registers the AI Image Generation format type and integrates BlockControls.
 *
 * @returns {void}
 */
(0,_wordpress_rich_text__WEBPACK_IMPORTED_MODULE_4__.registerFormatType)('wp-ai-image-gen/custom-format', {
  title: 'AI Image Gen',
  tagName: 'span',
  className: 'wp-ai-image-gen-format',
  edit: ({
    isActive,
    value,
    onChange
  }) => {
    // This edit function adds AI image functionality to the block.
    // Create state for the last used provider and generation state.
    const [lastUsedProvider, setLastUsedProvider] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_1__.useState)(''); // Stores the last used provider.
    const [isGenerating, setIsGenerating] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_1__.useState)(false); // Indicates if an image is being generated.

    // Retrieve the currently selected block.
    const selectedBlock = (0,_wordpress_data__WEBPACK_IMPORTED_MODULE_3__.useSelect)(select => select('core/block-editor').getSelectedBlock(), []);
    // Get the dispatch function to replace blocks.
    const {
      replaceBlocks
    } = (0,_wordpress_data__WEBPACK_IMPORTED_MODULE_3__.useDispatch)('core/block-editor');

    // Fetch the last used provider from localStorage when the component mounts.
    (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_1__.useEffect)(() => {
      const storedProvider = localStorage.getItem('wpAiImageGenLastProvider');
      if (storedProvider) {
        setLastUsedProvider(storedProvider);
      }
    }, []);

    /**
     * Handles the AI image generation process based on the selected text.
     *
     * @returns {void}
     */
    const handleGenerateImage = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_1__.useCallback)(() => {
      // This function manages image generation.
      if (selectedBlock && selectedBlock.name === 'core/paragraph') {
        // Extract the currently selected text.
        const selectedText = value.text.slice(value.start, value.end).trim();
        if (!selectedText) {
          // Create an error notice if no text is selected.
          wp.data.dispatch('core/notices').createErrorNotice('Please select some text to use as the image generation prompt.', {
            type: 'snackbar'
          });
          return;
        }

        // Create a placeholder block to show that image generation is in progress.
        const placeholderBlock = wp.blocks.createBlock('core/heading', {
          content: 'Generating AI image...',
          level: 2,
          style: {
            textAlign: 'center'
          }
        });
        // Replace the selected block with the placeholder.
        replaceBlocks(selectedBlock.clientId, [placeholderBlock, selectedBlock]);
        setIsGenerating(true); // Set generating state.

        // Call the API function to generate the image.
        (0,_api__WEBPACK_IMPORTED_MODULE_6__.generateImage)(selectedText, lastUsedProvider, result => {
          setIsGenerating(false); // Reset generating state.

          if (result.error) {
            console.error('Image generation failed:', result.error);
            wp.data.dispatch('core/notices').createErrorNotice('Failed to generate image: ' + result.error, {
              type: 'snackbar'
            });
            // Remove the placeholder block on error.
            replaceBlocks(placeholderBlock.clientId, []);
          } else {
            // Create a new image block with the image details
            let blockAttributes = {
              url: result.url,
              alt: result.alt,
              caption: ''
            };

            // Only add ID attribute if it's a valid WordPress media ID
            if (result.id && typeof result.id === 'number' && result.id > 0) {
              blockAttributes.id = result.id;
            }
            const imageBlock = wp.blocks.createBlock('core/image', blockAttributes);
            // Replace the placeholder with the new image block.
            replaceBlocks(placeholderBlock.clientId, [imageBlock]);
          }
        });
      }
    }, [selectedBlock, value.text, value.start, value.end, replaceBlocks, lastUsedProvider]);

    // Determine if any text is selected.
    const selectedText = value.text.slice(value.start, value.end).trim();
    const isTextSelected = selectedText !== "";
    return (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_wordpress_block_editor__WEBPACK_IMPORTED_MODULE_2__.BlockControls, null, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_components_AIImageToolbar__WEBPACK_IMPORTED_MODULE_5__["default"], {
      isGenerating: isGenerating,
      onGenerateImage: handleGenerateImage,
      isTextSelected: isTextSelected
    }));
  }
});

/***/ }),

/***/ "react":
/*!************************!*\
  !*** external "React" ***!
  \************************/
/***/ ((module) => {

module.exports = window["React"];

/***/ }),

/***/ "@wordpress/block-editor":
/*!*************************************!*\
  !*** external ["wp","blockEditor"] ***!
  \*************************************/
/***/ ((module) => {

module.exports = window["wp"]["blockEditor"];

/***/ }),

/***/ "@wordpress/components":
/*!************************************!*\
  !*** external ["wp","components"] ***!
  \************************************/
/***/ ((module) => {

module.exports = window["wp"]["components"];

/***/ }),

/***/ "@wordpress/data":
/*!******************************!*\
  !*** external ["wp","data"] ***!
  \******************************/
/***/ ((module) => {

module.exports = window["wp"]["data"];

/***/ }),

/***/ "@wordpress/element":
/*!*********************************!*\
  !*** external ["wp","element"] ***!
  \*********************************/
/***/ ((module) => {

module.exports = window["wp"]["element"];

/***/ }),

/***/ "@wordpress/hooks":
/*!*******************************!*\
  !*** external ["wp","hooks"] ***!
  \*******************************/
/***/ ((module) => {

module.exports = window["wp"]["hooks"];

/***/ }),

/***/ "@wordpress/rich-text":
/*!**********************************!*\
  !*** external ["wp","richText"] ***!
  \**********************************/
/***/ ((module) => {

module.exports = window["wp"]["richText"];

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/compat get default export */
/******/ 	(() => {
/******/ 		// getDefaultExport function for compatibility with non-harmony modules
/******/ 		__webpack_require__.n = (module) => {
/******/ 			var getter = module && module.__esModule ?
/******/ 				() => (module['default']) :
/******/ 				() => (module);
/******/ 			__webpack_require__.d(getter, { a: getter });
/******/ 			return getter;
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry need to be wrapped in an IIFE because it need to be isolated against other modules in the chunk.
(() => {
/*!**********************!*\
  !*** ./src/index.js ***!
  \**********************/
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _core_image_modifications__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./core-image-modifications */ "./src/core-image-modifications.js");

})();

/******/ })()
;
//# sourceMappingURL=index.js.map