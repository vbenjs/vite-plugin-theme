import { Plugin, ResolvedConfig, normalizePath } from 'vite';
import type { ViteThemeOptions, ResolveSelector } from './types';

import path from 'path';
import fs from 'fs-extra';
import { debug as Debug } from 'debug';

export * from '../client/colorUtils';

import {
  VITE_CLIENT_ENTRY,
  cssLangRE,
  cssVariableString,
  cssBlockRE,
  ruleRE,
  cssValueRE,
  safeEmptyRE,
  importSafeRE,
  CLIENT_PUBLIC_PATH,
  commentRE,
  VITE_PLUGIN_THEME_CLIENT_ENTRY,
  CLIENT_PUBLIC_ABSOLUTE_PATH,
} from './constants';

import { combineRegs, createHash, formatCss, getVariablesReg } from './utils';
import chalk from 'chalk';

const debug = Debug('vite-plugin-theme');

export function viteThemePlugin(opt: ViteThemeOptions): Plugin[] {
  let isServer = false;
  let config: ResolvedConfig;
  let clientPath = '';
  const styleMap = new Map<string, string>();

  let extCssString = '';

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

  const cssOutputName = `${fileName}.${createHash()}.css`;

  let needSourcemap = false;
  return [
    injectClientPlugin(options, cssOutputName),
    {
      ...emptyPlugin,
      enforce: 'post',

      configResolved(resolvedConfig) {
        config = resolvedConfig;
        isServer = resolvedConfig.command === 'serve';
        clientPath = JSON.stringify(path.posix.join(config.base, CLIENT_PUBLIC_PATH));
        needSourcemap = resolvedConfig.isProduction && !!resolvedConfig.build.sourcemap;
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
            extCssString += extractCssCodeTemplate;
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
        if (minify) {
          extCssString = await minifyCSS(extCssString, config);
        }

        const cssOutputPath = path.resolve(root, outDir, assetsDir, cssOutputName);
        fs.writeFile(cssOutputPath, extCssString);
      },
      closeBundle() {
        if (verbose) {
          const {
            build: { outDir, assetsDir },
          } = config;
          console.log(
            chalk.cyan('\n✨ [vite-plugin-theme]') + ` - extract css code file is successfully:`
          );
          console.log(
            chalk.gray(outDir + '/' + chalk.green(`${assetsDir}/${cssOutputName}`)) + '\n'
          );
        }
      },
    },
  ];
}

function injectClientPlugin(options: ViteThemeOptions, cssOutputName: string): Plugin {
  let config: ResolvedConfig;
  let isServer: boolean;
  let needSourcemap: boolean = false;
  return {
    name: 'vite:inject-vite-plugin-theme-client',
    enforce: 'pre',
    config: () => ({
      alias: [
        {
          find: /^\/@vite-plugin-theme\//,
          replacement: VITE_PLUGIN_THEME_CLIENT_ENTRY + '/',
        },
      ],
    }),

    configResolved(resolvedConfig) {
      config = resolvedConfig;
      isServer = resolvedConfig.command === 'serve';
      needSourcemap = resolvedConfig.isProduction && !!resolvedConfig.build.sourcemap;
    },

    transformIndexHtml: {
      enforce: 'pre',
      async transform(html) {
        return {
          html,
          tags: [
            {
              tag: 'script',
              attrs: {
                type: 'module',
                src: path.posix.join(CLIENT_PUBLIC_PATH),
              },
              injectTo: 'head-prepend',
            },
          ],
        };
      },
    },
    async transform(code, id) {
      const nid = normalizePath(id);
      const path = normalizePath('vite-plugin-theme/es/client.js');
      const getMap = () => (needSourcemap ? this.getCombinedSourcemap() : null);

      if (
        nid === CLIENT_PUBLIC_ABSOLUTE_PATH ||
        nid.endsWith(path) ||
        // support .vite cache
        nid.includes(path.replace(/\//gi, '_'))
      ) {
        debug('transform client file:', id, code);

        const {
          build: { assetsDir },
        } = config;

        return {
          code: code
            .replace(
              '__OUTPUT_FILE_NAME__',
              JSON.stringify(`${config.base}${assetsDir}/${cssOutputName}`)
            )
            .replace('__OPTIONS__', JSON.stringify(options))
            .replace('__PROD__', JSON.stringify(!isServer)),
          map: getMap(),
        };
      }
    },
  };
}

// Used to extract relevant color configuration in css
function extractVariable(code: string, colorVariables: string[], resolveSelector: ResolveSelector) {
  code = code.replace(commentRE, '');

  const cssBlocks = code.match(cssBlockRE);
  if (!cssBlocks || cssBlocks.length === 0) {
    return '';
  }

  let allExtractedVariable = '';

  const variableReg = getVariablesReg(colorVariables);

  for (let index = 0; index < cssBlocks.length; index++) {
    const cssBlock = cssBlocks[index];
    if (!variableReg.test(cssBlock) || !cssBlock) {
      continue;
    }

    const cssSelector = cssBlock.match(/[^{]*/)?.[0] ?? '';
    if (!cssSelector) {
      continue;
    }

    if (/^@.*keyframes/.test(cssSelector)) {
      allExtractedVariable += `${cssSelector}{${extractVariable(
        cssBlock.replace(/[^{]*\{/, '').replace(/}$/, ''),
        colorVariables,
        resolveSelector
      )}}`;
      continue;
    }

    const colorReg = combineRegs(
      'g',
      '',
      ruleRE,
      cssValueRE,
      safeEmptyRE,
      variableReg,
      importSafeRE
    );

    const colorReplaceTemplates = cssBlock.match(colorReg);

    if (!colorReplaceTemplates) {
      continue;
    }

    allExtractedVariable += `${resolveSelector(cssSelector)} {${colorReplaceTemplates.join(';')}}`;
  }

  return allExtractedVariable;
}

let CleanCSS: any;
async function minifyCSS(css: string, config: ResolvedConfig) {
  CleanCSS = CleanCSS || (await import('clean-css'));
  const res = new CleanCSS({
    rebase: false,
    ...config.build.cleanCssOptions,
  }).minify(css);

  if (res.errors && res.errors.length) {
    console.error(`error when minifying css:\n${res.errors}`);
    throw res.errors[0];
  }

  if (res.warnings && res.warnings.length) {
    config.logger.warn(`warnings when minifying css:\n${res.warnings}`);
  }

  return res.styles;
}

// Intercept the css code embedded in js
async function getClientStyleString(code: string) {
  if (!code.includes(VITE_CLIENT_ENTRY)) {
    return code;
  }

  const cssPrefix = cssVariableString;
  const cssPrefixLen = cssPrefix.length;

  const cssPrefixIndex = code.indexOf(cssPrefix);
  const len = cssPrefixIndex + cssPrefixLen;
  const cssLastIndex = code.indexOf('"', len + 1);

  if (cssPrefixIndex !== -1) {
    code = code.slice(len, cssLastIndex);
  }
  return code;
}
