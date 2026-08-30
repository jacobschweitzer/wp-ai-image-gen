require( '@testing-library/jest-dom' );

window.kaiGen = {
	logoUrl: 'https://example.com/kaigen.svg',
};

if ( ! window.ResizeObserver ) {
	window.ResizeObserver = class ResizeObserver {
		observe() {}

		unobserve() {}

		disconnect() {}
	};
}
