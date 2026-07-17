import fs from 'fs';
import path from 'path';

const readSource = ( relativePath ) =>
	fs.readFileSync( path.join( __dirname, '../..', relativePath ), 'utf8' );

describe( 'ImageAgentModal', () => {
	it( 'builds an article plan from the current editor state', () => {
		const source = readSource( 'src/components/ImageAgentModal.js' );

		expect( source ).toContain( 'buildImageAgentPlan' );
		expect( source ).toContain(
			"select( 'core/block-editor' ).getBlocks()"
		);
		expect( source ).toContain(
			"select( 'core/editor' ).getEditedPostAttribute( 'title' )"
		);
		expect( source ).toContain( 'Add more article content' );
	} );

	it( 'delegates selected package assets to the package runner', () => {
		const source = readSource( 'src/components/ImageAgentModal.js' );

		expect( source ).toContain( 'generateAndInsertAssets' );
		expect( source ).toContain( 'insertGeneratedAsset' );
		expect( source ).toContain( 'onProgress' );
		expect( source ).toContain( 'onStatus' );
		expect( source ).toContain( 'generateAndInsertPackage' );
		expect( source ).toContain( 'isGenerating' );
	} );

	it( 'applies each generated asset immediately instead of waiting for the whole package', () => {
		const source = readSource( 'src/components/ImageAgentModal.js' );

		expect( source ).toContain( 'insertGeneratedAsset,' );
		expect( source ).toContain( 'onProgress:' );
		expect( source ).not.toContain(
			'const generatedAssets = await generateAssets'
		);
	} );

	it( 'shows direct generation progress in the launcher button', () => {
		const source = readSource( 'src/components/ImageAgentModal.js' );

		expect( source ).toContain( 'completedAssetCount' );
		expect( source ).toContain( 'totalAssetCount' );
		expect( source ).toContain(
			'setCompletedAssetCount( completedCount )'
		);
		expect( source ).toMatch(
			/Generating \$\{\s*completedAssetCount\s*\}\/\$\{\s*totalAssetCount\s*\} images\.\.\./
		);
		expect( source ).toContain( 'Done' );
	} );

	it( 'stops the direct package run when generation is rate limited', () => {
		const runnerSource = readSource( 'src/image-agent/packageRunner.js' );
		const componentSource = readSource(
			'src/components/ImageAgentModal.js'
		);

		expect( runnerSource ).toContain( 'isRateLimitError' );
		expect( runnerSource ).toContain( 'RATE_LIMIT_RETRY_DELAYS_MS' );
		expect( componentSource ).toContain(
			'Image Agent hit a generation rate limit'
		);
		expect( runnerSource ).toContain( 'rateLimited' );
	} );

	it( 'uses a different rate-limit notice when no images finished', () => {
		const source = readSource( 'src/components/ImageAgentModal.js' );

		expect( source ).toContain( 'before any images finished' );
		expect( source ).toContain( 'Applied the completed images' );
		expect( source ).toMatch(
			/if \( rateLimited \) \{[\s\S]+if \( selectedCount === 0 \) \{/
		);
	} );

	it( 'accepts generated featured and article-body assets', () => {
		const source = readSource( 'src/components/ImageAgentModal.js' );

		expect( source ).toMatch(
			/dispatch\(\s*'core\/editor'\s*\)\.editPost\(\s*\{\s*featured_media:\s*media\.id,\s*\}\s*\)/
		);
		expect( source ).toContain(
			"window.wp.blocks.createBlock( 'core/image'"
		);
		expect( source ).toContain(
			"dispatch( 'core/block-editor' ).insertBlocks"
		);
		expect( source ).toContain( 'asset.insertIntoPost' );
		expect( source ).not.toContain( "asset.kind !== 'social'" );
		expect( source ).toContain( 'Image Agent package inserted.' );
	} );

	it( 'honors paragraph-level placement anchors when inserting generated blocks', () => {
		const source = readSource( 'src/components/ImageAgentModal.js' );

		expect( source ).toContain( 'placement?.beforeClientId' );
		expect( source ).toContain( 'placement?.afterClientId' );
		expect( source ).toMatch(
			/getBlockInsertionIndex\(\s*asset\.placement/
		);
	} );

	it( 'runs directly from the launcher without a review modal', () => {
		const source = readSource( 'src/components/ImageAgentModal.js' );

		expect( source ).toContain( 'onClick={ generateAndInsertPackage }' );
		expect( source ).not.toContain( '<Modal' );
		expect( source ).not.toContain( 'CheckboxControl' );
		expect( source ).not.toContain( 'Generate package' );
		expect( source ).not.toContain( '>Accept<' );
	} );
} );
