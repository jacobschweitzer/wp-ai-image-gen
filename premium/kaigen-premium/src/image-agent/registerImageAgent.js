// Mounts the premium Image Agent launcher in the block editor.

import { render } from '@wordpress/element';
import ImageAgentModal from '../components/ImageAgentModal';

const ROOT_ID = 'kaigen-image-agent-root';

const mountImageAgent = () => {
	if ( document.getElementById( ROOT_ID ) ) {
		return;
	}

	const root = document.createElement( 'div' );
	root.id = ROOT_ID;
	document.body.appendChild( root );

	render( <ImageAgentModal />, root );
};

if ( document.readyState === 'loading' ) {
	document.addEventListener( 'DOMContentLoaded', mountImageAgent );
} else {
	mountImageAgent();
}
