export type ResolveSelector = (selector: string) => string;

export type InjectTo = 'head' | 'body' | 'body-prepend';

export interface ViteThemeOptions {
  colorVariables: string[];
  wrapperCssSelector?: string;
  resolveSelector?: ResolveSelector;
  customerExtractVariable?: (code: string) => string;
  fileName?: string;
  injectTo?: InjectTo;
  verbose?: boolean;
}
