import { buildImageAgentPlan } from '../../src/image-agent/articlePlan';

const paragraph = ( clientId, content ) => ( {
	clientId,
	name: 'core/paragraph',
	attributes: { content },
} );

const heading = ( clientId, content, level = 2 ) => ( {
	clientId,
	name: 'core/heading',
	attributes: { content, level },
} );

const words = ( count, prefix ) =>
	Array.from(
		{ length: count },
		( _, index ) => `${ prefix }${ index }`
	).join( ' ' );

describe( 'buildImageAgentPlan', () => {
	it( 'returns a guardrail for drafts that are too short to illustrate well', () => {
		const plan = buildImageAgentPlan( {
			title: 'Tiny note',
			blocks: [ paragraph( 'p1', 'A short draft.' ) ],
		} );

		expect( plan.canGenerate ).toBe( false );
		expect( plan.reason ).toMatch( /more article content/i );
		expect( plan.assets ).toEqual( [] );
	} );

	it( 'plans only a featured image and article-body assets for a long structured draft', () => {
		const blocks = [
			paragraph(
				'intro',
				'The introduction frames the article with enough detail for useful image planning. Publishers need article visuals that explain the idea, reinforce the editorial angle, and keep readers moving through the story.'
			),
			heading( 'h1', 'Market context' ),
			paragraph(
				'p1',
				'This section compares cost, speed, and quality across several image workflows so editors can understand the tradeoffs before choosing a publishing assistant.'
			),
			heading( 'h2', 'Workflow impact' ),
			paragraph(
				'p2',
				'This section lists the workflow steps: draft review, image planning, image generation, social crop creation, and final approval. It needs an infographic-style visual.'
			),
			heading( 'h3', 'Revenue opportunities' ),
			paragraph(
				'p3',
				'This section describes a 35% lift in sponsored content output and explains how better article imagery can increase conversion rates for a lean publisher.'
			),
			heading( 'h4', 'Rollout plan' ),
			paragraph(
				'p4',
				'This section explains how the editorial team should roll out the assistant, train reviewers, evaluate quality, and maintain a consistent visual system.'
			),
		];

		const plan = buildImageAgentPlan( {
			title: 'AI image workflows for publishers',
			blocks,
		} );

		expect( plan.canGenerate ).toBe( true );
		expect( plan.assets ).toEqual(
			expect.arrayContaining( [
				expect.objectContaining( {
					id: 'featured-image',
					kind: 'featured',
					orientation: 'landscape',
					insertIntoPost: false,
				} ),
				expect.objectContaining( {
					kind: 'comparison',
					orientation: 'landscape',
					insertIntoPost: true,
				} ),
				expect.objectContaining( {
					kind: 'infographic',
					orientation: 'landscape',
					insertIntoPost: true,
				} ),
			] )
		);
		expect( plan.assets ).toHaveLength( 5 );
		expect( plan.assets.map( ( asset ) => asset.kind ) ).not.toContain(
			'social'
		);

		const sectionAssets = plan.assets.filter(
			( asset ) => asset.insertIntoPost
		);
		expect( sectionAssets ).toHaveLength( 4 );
		expect(
			sectionAssets.map( ( asset ) => asset.placement.beforeClientId )
		).toEqual( [ 'p1', 'p2', 'p3', 'p4' ] );
		expect(
			sectionAssets.map( ( asset ) => asset.placement.afterClientId )
		).toEqual( [ null, null, null, null ] );
		expect(
			plan.assets.every(
				( asset ) =>
					asset.prompt.includes(
						'AI image workflows for publishers'
					) &&
					asset.prompt.includes(
						'consistent editorial illustration style'
					)
			)
		).toBe( true );
	} );

	it( 'anchors section assets to contextual paragraphs when headings are absent', () => {
		const blocks = [
			paragraph(
				'p-monkey',
				'A rescued monkey adapts to a city wildlife sanctuary after losing its rainforest habitat. Editors need a concrete visual of the monkey, the canopy, and the sanctuary setting so this paragraph does not get a generic technology image.'
			),
			paragraph(
				'p-revenue',
				'The campaign numbers improved from 12% reader conversion to 38% reader conversion after the publisher added contextual article images. This paragraph should produce a numbers-led graphic instead of an unrelated illustration.'
			),
			paragraph(
				'p-workflow',
				'The editorial workflow starts with draft review, continues through image planning, moves into social crop creation, and ends with a final approval pass. The process needs a workflow-style visual placed beside this explanation.'
			),
			paragraph(
				'p-summary',
				'The conclusion compares manual image production with an automated publishing assistant, explaining the tradeoffs in speed, consistency, and revenue impact for a lean newsroom.'
			),
		];

		const plan = buildImageAgentPlan( {
			title: 'Contextual visuals for publishers',
			blocks,
		} );

		const sectionAssets = plan.assets.filter(
			( asset ) => asset.insertIntoPost
		);

		expect( plan.canGenerate ).toBe( true );
		expect( plan.assets ).toHaveLength( 5 );
		expect( plan.assets.map( ( asset ) => asset.kind ) ).not.toContain(
			'social'
		);
		expect( sectionAssets ).toHaveLength( 4 );
		expect(
			sectionAssets.map( ( asset ) => asset.placement.beforeClientId )
		).toEqual( [ 'p-monkey', 'p-revenue', 'p-workflow', 'p-summary' ] );
		expect(
			sectionAssets.map( ( asset ) => asset.placement.afterClientId )
		).toEqual( [ null, null, null, null ] );
		expect( sectionAssets[ 0 ].title ).toMatch( /monkey/i );
		expect( sectionAssets[ 0 ].prompt ).toMatch( /monkey|sanctuary/i );
		expect( sectionAssets[ 1 ].title ).toMatch( /12%|38%|conversion/i );
		expect( sectionAssets[ 1 ].prompt ).toMatch( /12%|38%|numbers/i );
		expect( sectionAssets[ 1 ].kind ).toBe( 'infographic' );
	} );

	it( 'scales article-body assets from contextual moments instead of a fixed cap', () => {
		const blocks = [
			paragraph(
				'p1',
				'The opening explains how a regional publisher uses editorial images to guide readers through a complex investigation. It describes the newsroom, the reporting process, and the emotional hook for the story.'
			),
			paragraph( 'p2', 'This short transition does not need an image.' ),
			paragraph(
				'p3',
				'The article compares manual image sourcing with an automated assistant, including the tradeoffs in speed, visual consistency, cost, editorial control, and reader engagement.'
			),
			paragraph(
				'p4',
				'The numbers section reports that completion rates rose from 18% to 41% after contextual illustrations were placed near the relevant paragraphs, with stronger results on mobile.'
			),
			paragraph( 'p5', 'More detail follows below.' ),
			paragraph(
				'p6',
				'The workflow section describes four steps: scan the draft, select visual moments, generate article images, and run a final editor approval pass before publishing.'
			),
			paragraph(
				'p7',
				'The case study describes a neighborhood map, an interview scene, and a timeline of public records that should be visualized for readers who skim the article.'
			),
			paragraph(
				'p8',
				'The conclusion explains how the team will measure repeat usage, editorial time saved, search traffic lift, and sponsor conversion over the next quarter.'
			),
		];

		const plan = buildImageAgentPlan( {
			title: 'Context-aware article illustration',
			blocks,
		} );
		const bodyAssets = plan.assets.filter(
			( asset ) => asset.insertIntoPost
		);

		expect( bodyAssets ).toHaveLength( 5 );
		expect( plan.assets ).toHaveLength( 6 );
		expect(
			bodyAssets.map( ( asset ) => asset.placement.beforeClientId )
		).toEqual( [ 'p1', 'p3', 'p4', 'p6', 'p7' ] );
	} );

	it( 'uses paragraph-level moments inside a headed section instead of collapsing the section', () => {
		const blocks = [
			heading( 'h1', 'Case study' ),
			paragraph(
				'p1',
				'The first paragraph describes a newsroom scene with editors reviewing photography, captions, source notes, and article structure before publication. It gives enough concrete detail for a useful contextual illustration.'
			),
			paragraph(
				'p2',
				'This transition is too short for its own image.'
			),
			paragraph(
				'p3',
				'The second visual moment compares manual research with automated planning, including tradeoffs in turnaround time, editorial review, and visual consistency across a busy publishing desk.'
			),
			paragraph(
				'p4',
				'The third visual moment reports that image planning time dropped from 52 minutes to 17 minutes while maintaining quality across repeat publishing workflows and giving editors clearer review points.'
			),
		];

		const plan = buildImageAgentPlan( {
			title: 'One heading with several visual moments',
			blocks,
		} );
		const bodyAssets = plan.assets.filter(
			( asset ) => asset.insertIntoPost
		);

		expect( bodyAssets ).toHaveLength( 3 );
		expect(
			bodyAssets.map( ( asset ) => asset.placement.beforeClientId )
		).toEqual( [ 'p1', 'p3', 'p4' ] );
		expect(
			bodyAssets.map( ( asset ) => asset.placement.afterClientId )
		).toEqual( [ null, null, null ] );
	} );

	it( 'uses a moderate visual density for mid-length pasted stories', () => {
		const blocks = Array.from( { length: 29 }, ( _, index ) =>
			paragraph( `p${ index + 1 }`, words( 50, `scene${ index }` ) )
		);

		const plan = buildImageAgentPlan( {
			title: 'Mid-length story',
			blocks,
		} );
		const bodyAssets = plan.assets.filter(
			( asset ) => asset.insertIntoPost
		);

		expect( plan.wordCount ).toBe( 1450 );
		expect( bodyAssets ).toHaveLength( 3 );
		expect( plan.assets ).toHaveLength( 4 );
	} );

	it( 'caps long pasted stories to an editorial image budget', () => {
		const blocks = Array.from( { length: 145 }, ( _, index ) =>
			paragraph( `p${ index + 1 }`, words( 42, `beat${ index }` ) )
		);

		const plan = buildImageAgentPlan( {
			title: 'Long story',
			blocks,
		} );
		const bodyAssets = plan.assets.filter(
			( asset ) => asset.insertIntoPost
		);
		const selectedIndexes = bodyAssets.map( ( asset ) =>
			Number( asset.placement.beforeClientId.replace( /^p/, '' ) )
		);

		expect( plan.wordCount ).toBe( 6090 );
		expect( bodyAssets ).toHaveLength( 5 );
		expect( plan.assets ).toHaveLength( 6 );
		expect( selectedIndexes[ 0 ] ).toBeLessThanOrEqual( 30 );
		expect( selectedIndexes[ selectedIndexes.length - 1 ] ).toBeGreaterThan(
			110
		);
	} );
} );
