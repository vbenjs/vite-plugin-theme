import path from 'path';
import { normalizePath } from 'vite';

export const VITE_CLIENT_ENTRY = '/@vite/client';

export const VITE_PLUGIN_THEME_CLIENT_ENTRY = normalizePath(
  path.resolve(process.cwd(), 'node_modules/vite-plugin-theme/es/')
);

export const CLIENT_PUBLIC_ABSOLUTE_PATH = normalizePath(
  VITE_PLUGIN_THEME_CLIENT_ENTRY + '/client.js'
);

export const CLIENT_PUBLIC_PATH = `/${VITE_PLUGIN_THEME_CLIENT_ENTRY}/client.js`;

export const commentRE = /\\\\?n|\n|\\\\?r|\/\*[\s\S]+?\*\//g;

const cssLangs = `\\.(css|less|sass|scss|styl|stylus|postcss)($|\\?)`;

export const cssVariableString = `const css = "`;

export const cssBlockRE = /[^}]*\{[^{]*\}/g;

export const cssLangRE = new RegExp(cssLangs);
export const ruleRE = /(\w+-)*\w+:/;
export const cssValueRE = /(\s?[a-z0-9]+\s)*/;
export const safeEmptyRE = /\s?/;
export const importSafeRE = /(\s*!important)?/;
