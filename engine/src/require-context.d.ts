// Webpack's require.context (Remotion bundles with webpack); lets Root discover episodes without a shared registry.
declare namespace NodeJS {
	interface Require {
		context(directory: string, recursive: boolean, filter: RegExp): {keys(): string[]; (id: string): unknown};
	}
}
