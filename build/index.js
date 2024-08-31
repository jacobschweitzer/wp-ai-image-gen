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
 * Generates an AI image based on the given prompt and provider
 * @param {string} prompt - The text prompt for image generation
 * @param {string} provider - The selected provider ID
 * @param {function} callback - Function to handle the generated image data
 */
const generateImage = (prompt, provider, callback) => {
  // Call the WordPress API to generate the image
  wp.apiFetch({
    path: '/wp-ai-image-gen/v1/generate-image',
    method: 'POST',
    data: {
      prompt,
      provider
    }
  }).then(response => {
    // If the response contains a valid URL, call the callback with image data
    if (response && response.url) {
      callback({
        url: response.url,
        alt: prompt,
        id: response.id
      });
    }
  }).catch(error => {
    // Log any errors and call the callback with null
    console.error('Error fetching image:', error);
    callback(null);
  });
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

/***/ }),

/***/ "react":
/*!************************!*\
  !*** external "React" ***!
  \************************/
/***/ ((module) => {

module.exports = window["React"];

/***/ }),

/***/ "@wordpress/components":
/*!************************************!*\
  !*** external ["wp","components"] ***!
  \************************************/
/***/ ((module) => {

module.exports = window["wp"]["components"];

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