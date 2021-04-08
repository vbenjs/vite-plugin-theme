import type { Plugin, ResolvedConfig } from 'vite';
import path from 'path';
import fs from 'fs-extra';
import less from 'less';
import { createFileHash, minifyCSS, extractVariable } from './utils';
import chalk from 'chalk';
import { colorRE } from './constants';
import { injectClientPlugin } from './injectClientPlugin';
// import { build } from 'esbuild';
// import { lessLoader } from './esbuild/less';
import { lessPlugin } from './preprocessor/less';

export interface AntdDarkThemeOption {
  darkModifyVars?: any;
  fileName?: string;
  verbose?: boolean;
  selector?: string;
  filter?: (id: string) => boolean;
  extractCss?: boolean;
}

// const esbuildRe = /(\.(svg|png|jpeg|jpg|gif|bmp|webp|ttf))|url/gi;

export function antdDarkThemePlugin(options: AntdDarkThemeOption): Plugin[] {
  const {
    darkModifyVars,
    verbose = true,
    fileName = 'app-antd-dark-theme-style',
    selector,
    filter,
    extractCss = true,
  } = options;
  let isServer = false;
  let needSourcemap = false;
  let config: ResolvedConfig;
  let extCssString = '';

  const styleMap = new Map<string, string>();
  const codeCache = new Map<string, { code: string; css: string }>();

  const cssOutputName = `${fileName}.${createFileHash()}.css`;

  const getCss = (css: string) => {
    return `[${selector || 'data-theme="dark"'}] {${css}}`;
  };

  return [
    injectClientPlugin('antdDarkPlugin', {
      antdDarkCssOutputName: cssOutputName,
      antdDarkExtractCss: extractCss,
    }),
    {
      name: 'vite:antd-dark-theme',
      enforce: 'pre',
      configResolved(resolvedConfig) {
        config = resolvedConfig;
        isServer = resolvedConfig.command === 'serve';
        needSourcemap = !!resolvedConfig.build.sourcemap;
      },

      async transform(code, id) {
        if (!id.endsWith('.less') || !code.includes('@')) {
          return null;
        }

        if (typeof filter === 'function' && !filter(id)) {
          return null;
        }

        const getResult = (content: string) => {
          return {
            map: needSourcemap ? this.getCombinedSourcemap() : null,
            code: content,
          };
        };

        let processCss = '';
        const cache = codeCache.get(id);
        const isUpdate = !cache || cache.code !== code;

        // const unSupportEsBuild = id.endsWith('lang.less') || code.match(esbuildRe);
        if (isUpdate) {
          let css = '';
          //  TODO process .vue less
          // if (unSupportEsBuild) {
          const result = await less.render(code, {
            javascriptEnabled: true,
            modifyVars: darkModifyVars,
            filename: path.resolve(id),
            plugins: [lessPlugin(id, config)],
          });
          css = result.css;
          // } else {
          //   const { outputFiles } = await build({
          //     entryPoints: [id],
          //     bundle: true,
          //     write: false,

          //     plugins: [
          //       lessLoader(code, {
          //         javascriptEnabled: true,
          //         modifyVars: darkModifyVars,
          //         filename: path.resolve(id),
          //         plugins: [lessPlugin(id, config)],
          //       }),
          //     ],
          //   });
          //   css = outputFiles?.[0]?.text ?? '';
          // }

          const colors = css.match(colorRE);
          if (colors) {
            // The theme only extracts css related to color
            // Can effectively reduce the size
            processCss = extractVariable(css, colors.concat(['transparent']));
          }
        } else {
          processCss = cache!.css;
        }

        if (isServer || !extractCss) {
          isUpdate && codeCache.set(id, { code, css: processCss });
          return getResult(`${getCss(processCss)}\n` + code);
        } else {
          if (!styleMap.has(id)) {
            let _css = '';

            // if (unSupportEsBuild) {
            const { css } = await less.render(getCss(processCss), {
              filename: path.resolve(id),
              plugins: [lessPlugin(id, config)],
            });
            _css = css;
            // } else {
            //   const { outputFiles } = await build({
            //     entryPoints: [id],
            //     bundle: true,
            //     write: false,
            //     plugins: [
            //       lessLoader(getCss(processCss), {
            //         filename: path.resolve(id),
            //         plugins: [lessPlugin(id, config)],
            //       }),
            //     ],
            //   });
            //   _css = outputFiles?.[0]?.text ?? '';
            // }

            extCssString += `${_css}\n`;
          }
          styleMap.set(id, processCss);
        }

        return null;
      },

      async writeBundle() {
        if (!extractCss) {
          return;
        }
        const {
          root,
          build: { outDir, assetsDir, minify },
        } = config;
        if (minify) {
          extCssString = await minifyCSS(extCssString, config);
        }
        const cssOutputPath = path.resolve(root, outDir, assetsDir, cssOutputName);
        fs.writeFileSync(cssOutputPath, extCssString);
      },

      closeBundle() {
        if (verbose && !isServer && extractCss) {
          const {
            build: { outDir, assetsDir },
          } = config;
          console.log(
            chalk.cyan('\n✨ [vite-plugin-theme:antd-dark]') +
              ` - extract antd dark css code file is successfully:`
          );
          const { size } = fs.statSync(path.join(outDir, assetsDir, cssOutputName));
          console.log(
            chalk.dim(outDir + '/') +
              chalk.magentaBright(`${assetsDir}/${cssOutputName}`) +
              `\t\t${chalk.dim((size / 1024).toFixed(2) + 'kb')}` +
              '\n'
          );
        }
      },
    },
  ];
}
