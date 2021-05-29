import { Plugin, ResolvedConfig } from 'vite';
import path from 'path';
import fs from 'fs-extra';
import { debug as Debug } from 'debug';
import { extractVariable, minifyCSS } from './utils';

export * from '../client/colorUtils';

export { antdDarkThemePlugin } from './antdDarkThemePlugin';

import { VITE_CLIENT_ENTRY, cssLangRE, cssVariableString, CLIENT_PUBLIC_PATH } from './constants';

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

import { createFileHash, formatCss } from './utils';
import chalk from 'chalk';
import { injectClientPlugin } from './injectClientPlugin';

const debug = Debug('vite-plugin-theme');

export function viteThemePlugin(opt: ViteThemeOptions): Plugin[] {
  let isServer = false;
  let config: ResolvedConfig;
  let clientPath = '';
  const styleMap = new Map<string, string>();

  let extCssSet = new Set<string>();

  const emptyPlugin: Plugin = {
    name: 'vite:theme',
  };

  const options: ViteThemeOptions = Object.assign(
    {
      colorVariables: [],
      wrapperCssSelector: '',
      fileName: 'app-theme-style',
      injectTo: 'body',
      verbose: true,
    },
    opt
  );

  debug('plugin options:', options);

  const {
    colorVariables,
    wrapperCssSelector,
    resolveSelector,
    customerExtractVariable,
    fileName,
    verbose,
  } = options;

  if (!colorVariables || colorVariables.length === 0) {
    console.error('colorVariables is not empty!');
    return [emptyPlugin];
  }

  const resolveSelectorFn = resolveSelector || ((s: string) => `${wrapperCssSelector} ${s}`);

  const cssOutputName = `${fileName}.${createFileHash()}.css`;

  let needSourcemap = false;
  return [
    injectClientPlugin('colorPlugin', {
      colorPluginCssOutputName: cssOutputName,
      colorPluginOptions: options,
    }),
    {
      ...emptyPlugin,
      enforce: 'post',
      configResolved(resolvedConfig) {
        config = resolvedConfig;
        isServer = resolvedConfig.command === 'serve';
        clientPath = JSON.stringify(path.posix.join(config.base, CLIENT_PUBLIC_PATH));
        needSourcemap = !!resolvedConfig.build.sourcemap;
        debug('plugin config:', resolvedConfig);
      },

      async transform(code, id) {
        if (!cssLangRE.test(id)) {
          return null;
        }
        const getResult = (content: string) => {
          return {
            map: needSourcemap ? this.getCombinedSourcemap() : null,
            code: content,
          };
        };

        const clientCode = isServer
          ? await getClientStyleString(code)
          : code.replace('export default', '').replace('"', '');

        // Used to extract the relevant color configuration in css, you can pass in the function to override
        const extractCssCodeTemplate =
          typeof customerExtractVariable === 'function'
            ? customerExtractVariable(clientCode)
            : extractVariable(clientCode, colorVariables, resolveSelectorFn);

        debug('extractCssCodeTemplate:', id, extractCssCodeTemplate);

        if (!extractCssCodeTemplate) {
          return null;
        }

        // dev-server
        if (isServer) {
          const retCode = [
            `import { addCssToQueue } from ${clientPath}`,
            `const themeCssId = ${JSON.stringify(id)}`,
            `const themeCssStr = ${JSON.stringify(formatCss(extractCssCodeTemplate))}`,
            `addCssToQueue(themeCssId, themeCssStr)`,
            code,
          ];

          return getResult(retCode.join('\n'));
        } else {
          if (!styleMap.has(id)) {
            extCssSet.add(extractCssCodeTemplate);
          }
          styleMap.set(id, extractCssCodeTemplate);
        }

        return null;
      },

      async writeBundle() {
        const {
          root,
          build: { outDir, assetsDir, minify },
        } = config;
        let extCssString = '';
        for (const css of extCssSet) {
          extCssString += css;
        }
        if (minify) {
          extCssString = await minifyCSS(extCssString, config);
        }
        const cssOutputPath = path.resolve(root, outDir, assetsDir, cssOutputName);
        fs.writeFileSync(cssOutputPath, extCssString);
      },

      closeBundle() {
        if (verbose && !isServer) {
          const {
            build: { outDir, assetsDir },
          } = config;
          console.log(
            chalk.cyan('\n✨ [vite-plugin-theme]') + ` - extract css code file is successfully:`
          );
          try {
            const { size } = fs.statSync(path.join(outDir, assetsDir, cssOutputName));
            console.log(
              chalk.dim(outDir + '/') +
                chalk.magentaBright(`${assetsDir}/${cssOutputName}`) +
                `\t\t${chalk.dim((size / 1024).toFixed(2) + 'kb')}` +
                '\n'
            );
          } catch (error) {}
        }
      },
    },
  ];
}

// Intercept the css code embedded in js
async function getClientStyleString(code: string) {
  if (!code.includes(VITE_CLIENT_ENTRY)) {
    return code;
  }
  code = code.replace(/\\n/g, '');
  const cssPrefix = cssVariableString;
  const cssPrefixLen = cssPrefix.length;

  const cssPrefixIndex = code.indexOf(cssPrefix);
  const len = cssPrefixIndex + cssPrefixLen;
  const cssLastIndex = code.indexOf('\n', len + 1);

  if (cssPrefixIndex !== -1) {
    code = code.slice(len, cssLastIndex);
  }
  return code;
}
