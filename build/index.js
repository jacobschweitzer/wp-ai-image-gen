/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./src/core-image-modifications.js":
/*!*****************************************!*\
  !*** ./src/core-image-modifications.js ***!
  \*****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "react");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _wordpress_hooks__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @wordpress/hooks */ "@wordpress/hooks");
/* harmony import */ var _wordpress_hooks__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_wordpress_hooks__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var _wordpress_element__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @wordpress/element */ "@wordpress/element");
/* harmony import */ var _wordpress_element__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(_wordpress_element__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var _wordpress_components__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @wordpress/components */ "@wordpress/components");
/* harmony import */ var _wordpress_components__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(_wordpress_components__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var _wordpress_rich_text__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @wordpress/rich-text */ "@wordpress/rich-text");
/* harmony import */ var _wordpress_rich_text__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(_wordpress_rich_text__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var _wordpress_block_editor__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @wordpress/block-editor */ "@wordpress/block-editor");
/* harmony import */ var _wordpress_block_editor__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(_wordpress_block_editor__WEBPACK_IMPORTED_MODULE_5__);
/* harmony import */ var _wordpress_data__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @wordpress/data */ "@wordpress/data");
/* harmony import */ var _wordpress_data__WEBPACK_IMPORTED_MODULE_6___default = /*#__PURE__*/__webpack_require__.n(_wordpress_data__WEBPACK_IMPORTED_MODULE_6__);

// Import necessary WordPress components and hooks










/**
 * Fetches available providers from the server.
 * @returns {Promise<Object>} A promise that resolves to an object of provider IDs and names.
 */
const fetchProviders = async () => {
  try {
    const response = await wp.apiFetch({
      path: '/wp-ai-image-gen/v1/providers'
    });
    return response;
  } catch (error) {
    console.error('Error fetching providers:', error);
    // Return an object with an error message that can be displayed to the user
    return {
      error: 'Unable to fetch providers. Please try again later.'
    };
  }
};

/**
 * Generates an AI image based on the given prompt and provider.
 * @param {string} prompt - The text prompt for image generation.
 * @param {string} provider - The selected provider ID.
 * @param {function} callback - Function to handle the generated image data.
 */
const generateImage = async (prompt, provider, callback) => {
  try {
    // Call the WordPress API to generate the image
    const response = await wp.apiFetch({
      path: '/wp-ai-image-gen/v1/generate-image',
      method: 'POST',
      data: {
        prompt,
        provider
      }
    });

    // If the response contains a valid URL, call the callback with image data
    if (response && response.url) {
      callback({
        url: response.url,
        alt: prompt,
        id: response.id
      });
    } else {
      // If the response doesn't contain a URL, throw an error
      throw new Error('Invalid response from server: ' + JSON.stringify(response));
    }
  } catch (error) {
    // Log the detailed error and call the callback with an error object
    console.error('Detailed error in generateImage:', error);
    if (error.message) console.error('Error message:', error.message);
    if (error.stack) console.error('Error stack:', error.stack);
    callback({
      error: error.message || 'Unknown error occurred'
    });
  }
};

/**
 * AITab component for generating AI images
 * @param {Object} props - Component props
 * @param {function} props.onSelect - Function to handle selected image
 */
const AITab = ({
  onSelect
}) => {
  // State hooks for modal, prompt, loading status, providers, and selected provider
  const [isModalOpen, setIsModalOpen] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_2__.useState)(false);
  const [prompt, setPrompt] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_2__.useState)('');
  const [isLoading, setIsLoading] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_2__.useState)(false);
  const [providers, setProviders] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_2__.useState)({});
  const [selectedProvider, setSelectedProvider] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_2__.useState)('');
  const [error, setError] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_2__.useState)(null);

  // Add a new state hook for the last used provider
  const [lastUsedProvider, setLastUsedProvider] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_2__.useState)('');

  // Fetch providers and last used provider when component mounts
  (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_2__.useEffect)(() => {
    fetchProviders().then(result => {
      if (result.error) {
        setError(result.error);
      } else {
        setProviders(result);

        // Retrieve the last used provider from local storage
        const storedProvider = localStorage.getItem('wpAiImageGenLastProvider');
        if (storedProvider && result[storedProvider]) {
          setSelectedProvider(storedProvider);
          setLastUsedProvider(storedProvider);
        } else {
          // If no stored provider or it's invalid, use the first available provider
          setSelectedProvider(Object.keys(result)[0]);
        }
      }
    });
  }, []);

  // Update local storage when the selected provider changes
  (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_2__.useEffect)(() => {
    if (selectedProvider) {
      localStorage.setItem('wpAiImageGenLastProvider', selectedProvider);
      setLastUsedProvider(selectedProvider);
    }
  }, [selectedProvider]);

  // Handler for image generation
  const handleGenerate = () => {
    setIsLoading(true);
    generateImage(prompt, selectedProvider, media => {
      onSelect(media);
      setIsLoading(false);
      setIsModalOpen(false);
    });
  };

  // Prepare provider options for dropdown
  const providerOptions = Object.entries(providers).map(([id, name]) => ({
    value: id,
    label: name
  }));
  return (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(react__WEBPACK_IMPORTED_MODULE_0__.Fragment, null, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("div", {
    className: "block-editor-media-placeholder__url-input-container"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_wordpress_components__WEBPACK_IMPORTED_MODULE_3__.Button, {
    variant: "tertiary",
    onClick: () => setIsModalOpen(true),
    className: "block-editor-media-placeholder__button"
  }, "Generate AI Image")), isModalOpen && (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_wordpress_components__WEBPACK_IMPORTED_MODULE_3__.Modal, {
    title: "WP AI Image Gen",
    onRequestClose: () => setIsModalOpen(false)
  }, error ? (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("p", {
    style: {
      color: 'red'
    }
  }, error) : (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(react__WEBPACK_IMPORTED_MODULE_0__.Fragment, null, providerOptions.length > 1 && (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_wordpress_components__WEBPACK_IMPORTED_MODULE_3__.SelectControl, {
    label: "Select Provider",
    value: selectedProvider,
    options: providerOptions,
    onChange: setSelectedProvider
  }), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_wordpress_components__WEBPACK_IMPORTED_MODULE_3__.TextControl, {
    label: "Enter your image prompt",
    value: prompt,
    onChange: setPrompt
  }), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_wordpress_components__WEBPACK_IMPORTED_MODULE_3__.Button, {
    variant: "primary",
    onClick: handleGenerate,
    disabled: isLoading || !selectedProvider || Object.keys(providers).length === 0
  }, isLoading ? (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(react__WEBPACK_IMPORTED_MODULE_0__.Fragment, null, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_wordpress_components__WEBPACK_IMPORTED_MODULE_3__.Spinner, null), "Generating...") : 'Generate Image'))));
};

// Add this new component after the AITab component
/**
 * RegenerateAIImage component for regenerating AI images in the core image block.
 * @param {Object} props - Component props
 * @param {Object} props.attributes - Block attributes
 * @param {function} props.setAttributes - Function to update block attributes
 */
const RegenerateAIImage = ({
  attributes,
  setAttributes
}) => {
  const [isRegenerating, setIsRegenerating] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_2__.useState)(false);
  const [error, setError] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_2__.useState)(null);
  const [lastUsedProvider, setLastUsedProvider] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_2__.useState)('');

  // Fetch the last used provider when the component mounts
  (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_2__.useEffect)(() => {
    const storedProvider = localStorage.getItem('wpAiImageGenLastProvider');
    if (storedProvider) {
      setLastUsedProvider(storedProvider);
    }
  }, []);

  // Handler for regenerating the AI image
  const handleRegenerate = () => {
    setIsRegenerating(true);
    setError(null);
    generateImage(attributes.alt, lastUsedProvider, result => {
      setIsRegenerating(false);
      if (result.error) {
        setError(result.error);
        console.error('Image regeneration failed:', result.error);
      } else {
        setAttributes({
          url: result.url,
          id: result.id
        });
      }
    });
  };
  return (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_wordpress_components__WEBPACK_IMPORTED_MODULE_3__.PanelBody, {
    title: "WP AI Image Gen"
  }, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_wordpress_components__WEBPACK_IMPORTED_MODULE_3__.Button, {
    variant: "secondary",
    onClick: handleRegenerate,
    disabled: isRegenerating || !lastUsedProvider,
    isBusy: isRegenerating
  }, isRegenerating ? 'Regenerating...' : 'Regenerate AI Image'), error && (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("p", {
    style: {
      color: 'red'
    }
  }, error));
};

// Register the custom format type for AI image generation from selected text
(0,_wordpress_rich_text__WEBPACK_IMPORTED_MODULE_4__.registerFormatType)('wp-ai-image-gen/custom-format', {
  title: 'AI Image Gen',
  tagName: 'span',
  className: 'wp-ai-image-gen-format',
  edit: ({
    isActive,
    value,
    onChange
  }) => {
    const [lastUsedProvider, setLastUsedProvider] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_2__.useState)('');
    const [isGenerating, setIsGenerating] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_2__.useState)(false);
    const selectedBlock = (0,_wordpress_data__WEBPACK_IMPORTED_MODULE_6__.useSelect)(select => select('core/block-editor').getSelectedBlock(), []);
    const {
      replaceBlocks
    } = (0,_wordpress_data__WEBPACK_IMPORTED_MODULE_6__.useDispatch)('core/block-editor');

    // Fetch the last used provider from localStorage when the component mounts
    (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_2__.useEffect)(() => {
      const storedProvider = localStorage.getItem('wpAiImageGenLastProvider');
      if (storedProvider) {
        setLastUsedProvider(storedProvider);
      }
    }, []);
    const handleGenerateImage = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_2__.useCallback)(() => {
      if (selectedBlock && selectedBlock.name === 'core/paragraph') {
        const selectedText = value.text;

        // Set the generating state to true before starting the image generation.
        setIsGenerating(true);
        generateImage(selectedText, lastUsedProvider, result => {
          // Set the generating state back to false after the image generation is complete.
          setIsGenerating(false);
          if (result.error) {
            console.error('Image generation failed:', result.error);
            wp.data.dispatch('core/notices').createErrorNotice('Failed to generate image: ' + result.error, {
              type: 'snackbar'
            });
          } else {
            const imageBlock = wp.blocks.createBlock('core/image', {
              url: result.url,
              alt: result.alt,
              caption: '' // Set an empty caption to prevent automatic caption generation.
            });
            replaceBlocks(selectedBlock.clientId, [imageBlock, selectedBlock]);
          }
        });
      }
    }, [selectedBlock, value.text, replaceBlocks, lastUsedProvider]);
    return (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_wordpress_block_editor__WEBPACK_IMPORTED_MODULE_5__.BlockControls, null, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_wordpress_components__WEBPACK_IMPORTED_MODULE_3__.ToolbarButton, {
      icon: isGenerating ? (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_wordpress_components__WEBPACK_IMPORTED_MODULE_3__.Spinner, null) : "art",
      title: isGenerating ? "Generating AI Image..." : "Generate AI Image",
      onClick: handleGenerateImage,
      isActive: isActive,
      disabled: isGenerating
    }));
  }
});

// Add the AI tab to the media modal using WordPress filter
(0,_wordpress_hooks__WEBPACK_IMPORTED_MODULE_1__.addFilter)('editor.MediaUpload', 'wp-ai-image-gen/add-ai-tab', OriginalMediaUpload => {
  // Return a new component that wraps the original MediaUpload
  return props => {
    return (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(OriginalMediaUpload, {
      ...props,
      render: originalProps => (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(react__WEBPACK_IMPORTED_MODULE_0__.Fragment, null, props.render(originalProps), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(AITab, {
        onSelect: props.onSelect
      }))
    });
  };
});

// Modify the existing addFilter function at the end of the file
(0,_wordpress_hooks__WEBPACK_IMPORTED_MODULE_1__.addFilter)('editor.BlockEdit', 'wp-ai-image-gen/add-regenerate-button', BlockEdit => {
  return props => {
    if (props.name !== 'core/image') {
      return (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(BlockEdit, {
        ...props
      });
    }
    return (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(react__WEBPACK_IMPORTED_MODULE_0__.Fragment, null, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(BlockEdit, {
      ...props
    }), (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(_wordpress_block_editor__WEBPACK_IMPORTED_MODULE_5__.InspectorControls, null, (0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)(RegenerateAIImage, {
      attributes: props.attributes,
      setAttributes: props.setAttributes
    })));
  };
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