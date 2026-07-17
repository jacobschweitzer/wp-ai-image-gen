import { select } from '@wordpress/data';

export const getKaiGenSettings = () => {
	const editorSettings = select( 'core/editor' )?.getEditorSettings() || {};
	return editorSettings.kaigen_settings || {};
};

export const isKaiGenAvailable = () =>
	getKaiGenSettings().is_ai_client_available === true &&
	( getKaiGenSettings().providers || [] ).some(
		( provider ) => provider.id !== 'auto'
	);
