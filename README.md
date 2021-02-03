# vite-plugin-theme

**English** | [中文](./README.zh_CN.md)

[![npm][npm-img]][npm-url] [![node][node-img]][node-url]

Vite plugin for dynamically changing the theme color of the interface

### Install (yarn or npm)

**node version:** >=12.0.0

**vite version:** >=2.0.0-beta.62

```
yarn add vite-plugin-theme -D
```

or

```
npm i vite-plugin-theme -D
```

## Usage

- Config plugin in vite.config.ts. In this way, the required functions can be introduced as needed

```ts
import { defineConfig, Plugin } from 'vite';
import vue from '@vitejs/plugin-vue';

import { viteThemePlugin, mixLighten, mixDarken, tinycolor } from 'vite-plugin-theme';

export default defineConfig({
  plugins: [
    vue(),
    viteThemePlugin({
      // Match the color to be modified
       colorVariables: [],
    });
  ],
});
```

## Options

`viteThemePlugin(Options)`

**Options**

| param | type | default | desc |
| --- | --- | --- | --- |
| colorVariables | `string[]` | - | If css contains the color value in the array, css will be extracted |
| wrapperCssSelector | `string` | - | Universal outer selector. You can pass in'body' and other selectors to increase the level |
| resolveSelector | `(selector:string)=>string` | - | Custom selector conversion |
| customerExtractVariable | `(css:string)=>string` | - | Custom css matching color extraction logic |
| fileName | `string` | `app-theme-style.hash.css` | File name output after packaging |
| injectTo | `body` or `head` or `body-prepend` | `body` | The css loaded in the production environment is injected into the label body |

## Sample project

[Vben Admin](https://github.com/anncwb/vue-vben-admin)

## Reference project

- [webpack-theme-color-replacer](https://github.com/hzsrc/webpack-theme-color-replacer)
- [webpack-stylesheet-variable-replacer-plugin](https://github.com/eaTong/webpack-stylesheet-variable-replacer-plugin)

## License

MIT

[npm-img]: https://img.shields.io/npm/v/vite-plugin-html.svg
[npm-url]: https://npmjs.com/package/vite-plugin-html
[node-img]: https://img.shields.io/node/v/vite-plugin-html.svg
[node-url]: https://nodejs.org/en/about/releases/
