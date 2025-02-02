// This is the main entry point for the AI image generation modifications.
// It imports the API functions, components, and filters so that they are registered and active.

import './api'; // Import API functions.
import './components/AITab'; // Import the AITab component.
import './components/AIImageToolbar'; // Import the toolbar component.
import './filters/registerFormatType'; // Register the rich-text format type.
import './filters/addMediaUploadFilter'; // Enhance the MediaUpload component.
import './filters/addBlockEditFilter'; // Enhance the BlockEdit (image regeneration) functionality.