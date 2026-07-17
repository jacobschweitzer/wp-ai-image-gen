const MIN_ARTICLE_WORDS = 80;
const MIN_VISUAL_MOMENT_WORDS = 18;
const SHORT_ARTICLE_WORDS = 800;
const MEDIUM_ARTICLE_WORDS = 2500;
const SHORT_ARTICLE_BODY_ASSET_LIMIT = 5;
const MAX_BODY_ASSETS = 5;
const MEDIUM_ARTICLE_WORDS_PER_BODY_ASSET = 500;
const LONG_ARTICLE_WORDS_PER_BODY_ASSET = 1200;
const PREFERRED_LONG_ARTICLE_MOMENT_WORDS = 30;

const COMPARISON_PATTERN =
	/\b(compare|compares|comparison|versus|vs\.?|tradeoff|tradeoffs|pros|cons|before|after)\b/i;

const INFOGRAPHIC_PATTERN =
	/\b(steps?|process|workflow|timeline|metric|metrics|percent|percentage|%|revenue|cost|table|list|rank|ranking)\b/i;

const INFOGRAPHIC_VISUAL_PATTERN =
	/\b(steps?|process|workflow|timeline|metric|metrics|percent|percentage|table|list|rank|ranking)\b|%|\d/i;

const stripMarkup = ( value = '' ) =>
	String( value )
		.replace( /<[^>]*>/g, ' ' )
		.replace( /&nbsp;/g, ' ' )
		.replace( /&amp;/g, '&' )
		.replace( /&#8217;|&rsquo;/g, "'" )
		.replace( /&#8220;|&#8221;|&ldquo;|&rdquo;/g, '"' )
		.replace( /\s+/g, ' ' )
		.trim();

const slugify = ( value ) =>
	stripMarkup( value )
		.toLowerCase()
		.replace( /[^a-z0-9]+/g, '-' )
		.replace( /^-+|-+$/g, '' );

const countWords = ( value ) => {
	const words = stripMarkup( value ).match( /\b[\w'-]+\b/g );
	return words ? words.length : 0;
};

const createContextTitle = ( text, fallbackIndex ) => {
	const cleanText = stripMarkup( text );
	const percentMatch = cleanText.match(
		/\b\d+(?:\.\d+)?%?(?:\s+(?:to|from|conversion|revenue|growth|lift|cost|readers?)){1,4}/i
	);

	if ( percentMatch ) {
		return percentMatch[ 0 ];
	}

	const meaningfulWords = cleanText
		.split( /\s+/ )
		.map( ( word ) => word.replace( /^[^\w%]+|[^\w%]+$/g, '' ) )
		.filter( ( word ) => word.length > 2 )
		.slice( 0, 6 );

	return meaningfulWords.length
		? meaningfulWords.join( ' ' )
		: `Article moment ${ fallbackIndex + 1 }`;
};

const getBlockText = ( block ) => {
	if ( ! block || typeof block !== 'object' ) {
		return '';
	}

	const { attributes = {}, name = '' } = block;

	if ( name === 'core/heading' ) {
		return stripMarkup( attributes.content );
	}

	if ( name === 'core/paragraph' || name === 'core/quote' ) {
		return stripMarkup( attributes.content || attributes.value );
	}

	if ( name === 'core/list' ) {
		return stripMarkup( attributes.values || attributes.content );
	}

	if ( name === 'core/image' ) {
		return stripMarkup( attributes.alt || attributes.caption );
	}

	if ( Array.isArray( block.innerBlocks ) ) {
		return block.innerBlocks
			.map( getBlockText )
			.filter( Boolean )
			.join( ' ' );
	}

	return '';
};

const isHeadingBlock = ( block ) => block?.name === 'core/heading';

const createSection = ( headingBlock, fallbackIndex ) => {
	const title = headingBlock
		? stripMarkup( headingBlock.attributes?.content )
		: 'Article introduction';

	return {
		id: slugify( title ) || `section-${ fallbackIndex + 1 }`,
		title,
		headingClientId: headingBlock?.clientId || null,
		anchorClientId: headingBlock?.clientId || null,
		startIndex: fallbackIndex,
		text: '',
		wordCount: 0,
		hasComparisonSignal: false,
		hasInfographicSignal: false,
	};
};

const extractSections = ( blocks ) => {
	const sections = [];
	let currentSection = createSection( null, 0 );

	blocks.forEach( ( block, index ) => {
		if ( isHeadingBlock( block ) ) {
			if (
				currentSection.wordCount > 0 ||
				currentSection.headingClientId
			) {
				sections.push( currentSection );
			}
			currentSection = createSection( block, index );
			return;
		}

		const text = getBlockText( block );
		if ( ! text ) {
			return;
		}

		currentSection.text = `${ currentSection.text } ${ text }`.trim();
		currentSection.wordCount += countWords( text );
		currentSection.hasComparisonSignal =
			currentSection.hasComparisonSignal ||
			COMPARISON_PATTERN.test( text );
		currentSection.hasInfographicSignal =
			currentSection.hasInfographicSignal ||
			INFOGRAPHIC_PATTERN.test( text );
	} );

	if ( currentSection.wordCount > 0 || currentSection.headingClientId ) {
		sections.push( currentSection );
	}

	return sections;
};

const extractContentMoments = ( blocks ) =>
	blocks
		.map( ( block, index ) => {
			if ( isHeadingBlock( block ) ) {
				return null;
			}

			const text = getBlockText( block );
			const wordCount = countWords( text );

			if ( ! text || wordCount < MIN_VISUAL_MOMENT_WORDS ) {
				return null;
			}

			return {
				id: slugify( text ) || `moment-${ index + 1 }`,
				title: createContextTitle( text, index ),
				headingClientId: null,
				anchorClientId: block.clientId || null,
				startIndex: index,
				text,
				wordCount,
				hasComparisonSignal: COMPARISON_PATTERN.test( text ),
				hasInfographicSignal: INFOGRAPHIC_PATTERN.test( text ),
			};
		} )
		.filter( Boolean );

const buildPrompt = ( { title, usage, context, detail } ) =>
	[
		`Article: ${ title || 'Untitled article' }.`,
		`Create ${ usage } in a consistent editorial illustration style.`,
		detail,
		context ? `Relevant article context: ${ context }` : '',
		'Avoid logos, fake UI, illegible text, and misleading claims.',
	]
		.filter( Boolean )
		.join( ' ' );

const createFeaturedAsset = ( title, context ) => ( {
	id: 'featured-image',
	kind: 'featured',
	title: 'Featured image',
	orientation: 'landscape',
	insertIntoPost: false,
	selected: true,
	placement: null,
	prompt: buildPrompt( {
		title,
		usage: 'a featured image for the article',
		context,
		detail: 'Represent the central editorial idea with a polished, publication-ready composition.',
	} ),
} );

const createPlacement = ( target ) => ( {
	beforeClientId: target?.headingClientId
		? null
		: target?.anchorClientId || null,
	afterClientId: target?.headingClientId || null,
	sectionTitle: target?.title || 'Article summary',
} );

const createSectionAsset = ( title, section, index ) => ( {
	id: `${ getBodyAssetKind( section ) }-${
		slugify( section.title ) || index + 1
	}`,
	kind: getBodyAssetKind( section ),
	title: section.title,
	orientation: 'landscape',
	insertIntoPost: true,
	selected: true,
	placement: createPlacement( section ),
	prompt: buildPrompt( getBodyAssetPrompt( title, section ) ),
} );

const getBodyAssetKind = ( section ) => {
	if ( INFOGRAPHIC_VISUAL_PATTERN.test( section?.text || '' ) ) {
		return 'infographic';
	}

	if ( section?.hasComparisonSignal ) {
		return 'comparison';
	}

	return 'section';
};

const getBodyAssetPrompt = ( title, section ) => {
	const kind = getBodyAssetKind( section );
	const prompts = {
		comparison: {
			usage: `a comparison graphic for "${ section.title }"`,
			detail: 'Show the compared options, tradeoffs, or before-and-after contrast in a clear editorial composition without relying on dense readable text.',
		},
		infographic: {
			usage: `an infographic-style editorial visual for "${ section.title }"`,
			detail: 'Summarize the process, metrics, list, or explanatory structure visually without relying on dense readable text.',
		},
		section: {
			usage: `an inline section illustration for "${ section.title }"`,
			detail: 'Focus on the section idea, avoid restating the headline as text, and keep the visual style aligned with the rest of the article.',
		},
	};

	return {
		title,
		context: section.text,
		...prompts[ kind ],
	};
};

const getBodyAssetBudget = ( wordCount, candidateCount ) => {
	if (
		candidateCount <= SHORT_ARTICLE_BODY_ASSET_LIMIT ||
		wordCount < SHORT_ARTICLE_WORDS
	) {
		return Math.min( candidateCount, SHORT_ARTICLE_BODY_ASSET_LIMIT );
	}

	const wordsPerAsset =
		wordCount < MEDIUM_ARTICLE_WORDS
			? MEDIUM_ARTICLE_WORDS_PER_BODY_ASSET
			: LONG_ARTICLE_WORDS_PER_BODY_ASSET;

	return Math.min(
		candidateCount,
		MAX_BODY_ASSETS,
		Math.max( 3, Math.ceil( wordCount / wordsPerAsset ) )
	);
};

const getMomentScore = ( moment, bucketCenterIndex ) => {
	let score = Math.min( moment.wordCount, 180 ) / 30;

	if ( moment.hasInfographicSignal ) {
		score += 4;
	}

	if ( moment.hasComparisonSignal ) {
		score += 3;
	}

	if ( moment.wordCount < PREFERRED_LONG_ARTICLE_MOMENT_WORDS ) {
		score -= 2;
	}

	if ( /^[“"]/.test( moment.text || '' ) ) {
		score -= 1;
	}

	return score - Math.abs( moment.startIndex - bucketCenterIndex ) / 1000;
};

const selectRepresentativeMoments = ( moments, wordCount ) => {
	const budget = getBodyAssetBudget( wordCount, moments.length );

	if ( moments.length <= budget ) {
		return moments;
	}

	const preferredMoments = moments.filter(
		( moment ) =>
			moment.wordCount >= PREFERRED_LONG_ARTICLE_MOMENT_WORDS ||
			moment.hasComparisonSignal ||
			moment.hasInfographicSignal
	);
	const candidates =
		preferredMoments.length >= budget ? preferredMoments : moments;
	const bucketSize = candidates.length / budget;
	const selectedMoments = [];

	for ( let index = 0; index < budget; index++ ) {
		const start = Math.floor( index * bucketSize );
		const end = Math.min(
			candidates.length,
			Math.max( start + 1, Math.floor( ( index + 1 ) * bucketSize ) )
		);
		const bucketCenterIndex =
			candidates[ Math.min( candidates.length - 1, start ) ]
				?.startIndex || 0;
		const bucketCandidates = candidates.slice( start, end );
		const selectedMoment = bucketCandidates.reduce(
			( bestMoment, moment ) =>
				getMomentScore( moment, bucketCenterIndex ) >
				getMomentScore( bestMoment, bucketCenterIndex )
					? moment
					: bestMoment,
			bucketCandidates[ 0 ]
		);

		selectedMoments.push( selectedMoment );
	}

	return selectedMoments.sort(
		( firstMoment, secondMoment ) =>
			firstMoment.startIndex - secondMoment.startIndex
	);
};

/**
 * Builds a deterministic Image Agent plan from Gutenberg editor content.
 *
 * @param {Object}   article        Article input.
 * @param {string}   article.title  Current post title.
 * @param {Object[]} article.blocks Current Gutenberg blocks.
 * @return {Object} Image Agent plan.
 */
export const buildImageAgentPlan = ( { title = '', blocks = [] } = {} ) => {
	const safeBlocks = Array.isArray( blocks ) ? blocks : [];
	const sections = extractSections( safeBlocks );
	const articleText = sections.map( ( section ) => section.text ).join( ' ' );
	const wordCount = countWords( articleText );

	if ( wordCount < MIN_ARTICLE_WORDS ) {
		return {
			canGenerate: false,
			reason: 'Add more article content before running Image Agent. The agent needs headings or body text to plan useful visuals.',
			wordCount,
			sections,
			assets: [],
		};
	}

	const safeTitle = stripMarkup( title );
	const context = articleText.slice( 0, 900 );
	const contentMoments = extractContentMoments( safeBlocks );
	const firstHeadingIndex = safeBlocks.findIndex( isHeadingBlock );
	const headingSections = sections.filter(
		( section ) =>
			section.headingClientId &&
			section.wordCount >= MIN_VISUAL_MOMENT_WORDS
	);
	const articleBodyMoments =
		firstHeadingIndex >= 0
			? contentMoments.filter(
					( section ) => section.startIndex > firstHeadingIndex
			  )
			: contentMoments;
	const majorSections = articleBodyMoments.length
		? articleBodyMoments
		: headingSections;
	const selectedSections = selectRepresentativeMoments(
		majorSections,
		wordCount
	);

	const assets = [
		createFeaturedAsset( safeTitle, context ),
		...selectedSections.map( ( section, index ) =>
			createSectionAsset( safeTitle, section, index )
		),
	];

	return {
		canGenerate: true,
		reason: '',
		title: safeTitle,
		wordCount,
		sections,
		assets,
	};
};
