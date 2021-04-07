import path from 'path';
import { ResolvedConfig, normalizePath, Plugin } from 'vite';
import { ViteThemeOptions } from '.';
import { CLIENT_PUBLIC_PATH, CLIENT_PUBLIC_ABSOLUTE_PATH } from './constants';
import { debug as Debug } from 'debug';

const debug = Debug('vite:inject-vite-plugin-theme-client');

type PluginType = 'colorPlugin' | 'antdDarkPlugin';

export function injectClientPlugin(
  type: PluginType,
  {
    colorPluginOptions,
    colorPluginCssOutputName,
    antdDarkCssOutputName,
    antdDarkExtractCss,
  }: {
    colorPluginOptions?: ViteThemeOptions;
    antdDarkCssOutputName?: string;
    colorPluginCssOutputName?: string;
    antdDarkExtractCss?: boolean;
  }
): Plugin {
  let config: ResolvedConfig;
  let isServer: boolean;
  let needSourcemap = false;
  return {
    name: 'vite:inject-vite-plugin-theme-client',
    enforce: 'pre',
    configResolved(resolvedConfig) {
      config = resolvedConfig;
      isServer = resolvedConfig.command === 'serve';
      needSourcemap = !!resolvedConfig.build.sourcemap;
    },

    transformIndexHtml: {
      enforce: 'pre',
      async transform(html) {
        if (html.includes(CLIENT_PUBLIC_PATH)) {
          return html;
        }
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

        const getOutputFile = (name?: string) => {
          return JSON.stringify(`${config.base}${assetsDir}/${name}`);
        };

        if (type === 'colorPlugin') {
          code = code
            .replace('__COLOR_PLUGIN_OUTPUT_FILE_NAME__', getOutputFile(colorPluginCssOutputName))
            .replace('__COLOR_PLUGIN_OPTIONS__', JSON.stringify(colorPluginOptions));
        }

        if (type === 'antdDarkPlugin') {
          code = code.replace(
            '__ANTD_DARK_PLUGIN_OUTPUT_FILE_NAME__',
            getOutputFile(antdDarkCssOutputName)
          );
          if (typeof antdDarkExtractCss === 'boolean') {
            code = code.replace(
              '__ANTD_DARK_PLUGIN_EXTRACT_CSS__',
              JSON.stringify(antdDarkExtractCss)
            );
          }
        }

        return {
          code: code.replace('__PROD__', JSON.stringify(!isServer)),
          map: getMap(),
        };
      }
    },
  };
}
