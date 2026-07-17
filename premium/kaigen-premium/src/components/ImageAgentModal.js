// Premium post-level workflow for illustrating existing Gutenberg drafts.

import { useEffect, useRef, useState } from '@wordpress/element';
import { Button, Dashicon, Spinner } from '@wordpress/components';
import { dispatch, select } from '@wordpress/data';
import { buildImageAgentPlan } from '../image-agent/articlePlan';
import { generateAndInsertAssets } from '../image-agent/packageRunner';
import { getKaiGenSettings, isKaiGenAvailable } from '../utils/kaigenSettings';

const DONE_MESSAGE_DURATION = 1500;

const getPostTitle = () => {
	const title = select( 'core/editor' ).getEditedPostAttribute( 'title' );

	if ( typeof title === 'string' ) {
		return title;
	}

	return title?.raw || title?.rendered || '';
};

const getBlockInsertionIndex = ( placement ) => {
	const blocks = select( 'core/block-editor' ).getBlocks();

	if ( placement?.beforeClientId ) {
		const blockIndex = blocks.findIndex(
			( block ) => block.clientId === placement.beforeClientId
		);

		if ( blockIndex >= 0 ) {
			return blockIndex;
		}
	}

	if ( placement?.afterClientId ) {
		const blockIndex = blocks.findIndex(
			( block ) => block.clientId === placement.afterClientId
		);

		if ( blockIndex >= 0 ) {
			return blockIndex + 1;
		}
	}

	return blocks.length;
};

const insertGeneratedAsset = ( asset ) => {
	if ( asset.kind === 'featured' && asset.media?.id ) {
		const { media } = asset;
		dispatch( 'core/editor' ).editPost( {
			featured_media: media.id,
		} );

		return {
			inserted: false,
			selected: true,
		};
	}

	if ( ! asset.insertIntoPost || ! asset.media?.url ) {
		return {
			inserted: false,
			selected: false,
		};
	}

	const imageBlock = window.wp.blocks.createBlock( 'core/image', {
		id: asset.media.id,
		url: asset.media.url,
		alt: asset.media.alt || asset.prompt,
		caption: asset.title,
	} );
	const insertionIndex = getBlockInsertionIndex( asset.placement );

	dispatch( 'core/block-editor' ).insertBlocks(
		[ imageBlock ],
		insertionIndex
	);

	return {
		inserted: true,
		selected: true,
	};
};

/**
 * Image Agent editor-level launcher.
 *
 * @return {Object|null} Rendered launcher button.
 */
const ImageAgentModal = () => {
	const [ isGenerating, setIsGenerating ] = useState( false );
	const [ completedAssetCount, setCompletedAssetCount ] = useState( 0 );
	const [ totalAssetCount, setTotalAssetCount ] = useState( 0 );
	const [ generationStatusMessage, setGenerationStatusMessage ] =
		useState( '' );
	const [ isDone, setIsDone ] = useState( false );
	const doneTimeoutRef = useRef();

	const clearDoneTimeout = () => {
		if ( doneTimeoutRef.current ) {
			window.clearTimeout( doneTimeoutRef.current );
			doneTimeoutRef.current = undefined;
		}
	};

	useEffect( () => clearDoneTimeout, [] );

	const resetProgress = () => {
		clearDoneTimeout();
		setCompletedAssetCount( 0 );
		setTotalAssetCount( 0 );
		setGenerationStatusMessage( '' );
		setIsDone( false );
	};

	const showDoneProgress = () => {
		clearDoneTimeout();
		setIsDone( true );
		doneTimeoutRef.current = window.setTimeout( () => {
			setCompletedAssetCount( 0 );
			setTotalAssetCount( 0 );
			setGenerationStatusMessage( '' );
			setIsDone( false );
			doneTimeoutRef.current = undefined;
		}, DONE_MESSAGE_DURATION );
	};

	const getLauncherLabel = () => {
		if ( isDone ) {
			return 'Done';
		}

		if ( isGenerating && generationStatusMessage ) {
			return generationStatusMessage;
		}

		if ( isGenerating && totalAssetCount > 0 ) {
			return `Generating ${ completedAssetCount }/${ totalAssetCount } images...`;
		}

		if ( isGenerating ) {
			return 'Generating...';
		}

		return 'Image Agent';
	};

	const createErrorNotice = ( message ) => {
		dispatch( 'core/notices' ).createErrorNotice( message, {
			type: 'snackbar',
		} );
	};

	const generateAndInsertPackage = async () => {
		if ( isGenerating ) {
			return;
		}

		if ( ! isKaiGenAvailable() ) {
			createErrorNotice( 'WordPress AI Client is not available.' );
			return;
		}

		const plan = buildImageAgentPlan( {
			title: getPostTitle(),
			blocks: select( 'core/block-editor' ).getBlocks(),
		} );

		if ( ! plan.canGenerate ) {
			createErrorNotice(
				plan.reason ||
					'Add more article content before running Image Agent.'
			);
			return;
		}

		resetProgress();
		setTotalAssetCount( plan.assets.length );
		setIsGenerating( true );
		let didComplete = false;

		try {
			const { insertedCount, selectedCount, rateLimited } =
				await generateAndInsertAssets(
					plan.assets,
					getKaiGenSettings(),
					{
						insertGeneratedAsset,
						onProgress: ( completedCount ) => {
							setCompletedAssetCount( completedCount );
						},
						onStatus: setGenerationStatusMessage,
					}
				);

			if ( rateLimited ) {
				if ( selectedCount === 0 ) {
					createErrorNotice(
						'Image Agent hit a generation rate limit before any images finished. Try again later.'
					);

					return;
				}

				createErrorNotice(
					`Image Agent hit a generation rate limit after ${ selectedCount } ${
						selectedCount === 1 ? 'image' : 'images'
					} finished. Applied the completed images; try again later for the rest.`
				);

				return;
			}

			if ( selectedCount === 0 ) {
				createErrorNotice(
					'Image Agent could not generate any images for this article.'
				);
				return;
			}

			dispatch( 'core/notices' ).createSuccessNotice(
				'Image Agent package inserted.',
				{ type: 'snackbar' }
			);

			if ( insertedCount === 0 ) {
				dispatch( 'core/notices' ).createSuccessNotice(
					'Featured image set.',
					{ type: 'snackbar' }
				);
			}

			didComplete = true;
			showDoneProgress();
		} catch ( insertionError ) {
			createErrorNotice(
				insertionError.message ||
					'Image Agent generated images but could not insert them.'
			);
		} finally {
			setIsGenerating( false );

			if ( ! didComplete ) {
				setCompletedAssetCount( 0 );
				setTotalAssetCount( 0 );
				setGenerationStatusMessage( '' );
			}
		}
	};

	const launcherLabel = getLauncherLabel();

	return (
		<Button
			className="kaigen-image-agent-launcher"
			onClick={ generateAndInsertPackage }
			aria-label={ launcherLabel }
			disabled={ isGenerating || isDone }
		>
			{ isGenerating ? (
				<Spinner />
			) : (
				<Dashicon icon={ isDone ? 'yes-alt' : 'images-alt2' } />
			) }
			<span>{ launcherLabel }</span>
		</Button>
	);
};

export default ImageAgentModal;
