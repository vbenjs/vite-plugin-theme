export const globalField = '__VITE_THEME__';
export const styleTagId = '__VITE_PLUGIN_THEME__';

export interface Options {
  colorVariables: string[];
  wrapperCssSelector?: string;
  resolveSelector?: (selector: string) => string;
  fileName?: string;
  inline?: boolean;
  injectTo?: InjectTo;
}

export interface GlobalConfig {
  replaceStyleVariables: ({ colorVariables }: { colorVariables: string[] }) => void;
  colorVariables: string[];
  defaultOptions: Options;
  appended?: boolean;
  styleIdMap?: Map<string, string>;
  styleRenderQueueMap?: Map<string, string>;
}

export type InjectTo = 'head' | 'body' | 'body-prepend';

declare global {
  interface Window {
    [globalField]: GlobalConfig;
  }
}
declare const __OPTIONS__: Options;
declare const __OUTPUT_FILE_NAME__: string;
declare const __PROD__: boolean;

const outputFileName = __OUTPUT_FILE_NAME__;
const isProd = __PROD__;

const options = __OPTIONS__;

const injectTo = options.injectTo;
const debounceRender = debounce(30, render);

(() => {
  if (!window[globalField]) {
    window[globalField] = {
      styleIdMap: new Map(),
      styleRenderQueueMap: new Map(),
    } as any;
  }
  setGlobalOptions('replaceStyleVariables', replaceStyleVariables);
  if (!getGlobalOptions('defaultOptions')) {
    // assign defines
    setGlobalOptions('defaultOptions', options);
  }
})();

export async function replaceStyleVariables({ colorVariables }: { colorVariables: string[] }) {
  setGlobalOptions('colorVariables', colorVariables);
  const styleIdMap = getGlobalOptions('styleIdMap')!;
  const styleRenderQueueMap = getGlobalOptions('styleRenderQueueMap')!;
  if (!isProd) {
    for (let [id, css] of styleIdMap.entries()) {
      styleRenderQueueMap.set(id, css);
    }
    render();
  } else {
    try {
      const cssText = await fetchCss();
      const processCss = await replaceCssColors(cssText, colorVariables);
      appendCssToDom(processCss, injectTo);
    } catch (error) {
      throw new Error(error);
    }
  }
}

export function addCssToQueue(id: string, styleString: string) {
  const styleIdMap = getGlobalOptions('styleIdMap')!;

  if (!styleIdMap.get(id)) {
    window[globalField].styleRenderQueueMap!.set(id, styleString);
    debounceRender();
  }
}

function render() {
  const variables = getGlobalOptions('colorVariables')!;
  const styleRenderQueueMap = getGlobalOptions('styleRenderQueueMap')!;
  if (!variables) return;

  const style = getStyleDom();
  let html = style.innerHTML;
  for (let [id, css] of styleRenderQueueMap.entries()) {
    html += css;
    window[globalField].styleRenderQueueMap!.delete(id);
    window[globalField].styleIdMap!.set(id, css);
  }
  replaceCssColors(html, variables).then((processCss) => {
    appendCssToDom(processCss, injectTo);
  });
}

function debounce(delay: number, fn: (...arg: any[]) => any) {
  let timer;
  return function (...args) {
    // @ts-ignore
    const ctx = this;
    clearTimeout(timer);
    timer = setTimeout(function () {
      fn.apply(ctx, args);
    }, delay);
  };
}

export function setGlobalOptions<T extends keyof GlobalConfig = any>(
  key: T,
  value: GlobalConfig[T]
) {
  window[globalField][key] = value;
}

export function getGlobalOptions<T extends keyof GlobalConfig = any>(key: T): GlobalConfig[T] {
  return window[globalField][key];
}

export function getStyleDom() {
  let style = document.getElementById(styleTagId);
  if (!style) {
    style = document.createElement('style');
    style.setAttribute('id', styleTagId);
    // document.head.appendChild(style);
  }
  return style;
}

// Used to replace css color variables. Note that the order of the two arrays must be the same
export async function replaceCssColors(css: string, colors: string[]) {
  let retCss: string = css;
  const defaultOptions = getGlobalOptions('defaultOptions');
  const colorVariables = defaultOptions ? defaultOptions.colorVariables || [] : [];

  colorVariables.forEach(function (color, index) {
    const reg = new RegExp(
      color.replace(/,/g, ',\\s*').replace(/\s/g, '').replace('(', `\\(`).replace(')', `\\)`) +
        '([\\da-f]{2})?(\\b|\\)|,|\\s)',
      'ig'
    );

    retCss = retCss.replace(reg, colors[index] + '$1$2');
  });
  return retCss;
}

export async function appendCssToDom(cssText: string, appendTo: InjectTo = 'body') {
  const styleDom = getStyleDom();
  styleDom.innerHTML = cssText;
  if (appendTo === 'head') {
    document.head.appendChild(styleDom);
  } else if (appendTo === 'body') {
    document.body.appendChild(styleDom);
  } else if (appendTo === 'body-prepend') {
    const firstChildren = document.body.firstChild;
    document.body.insertBefore(styleDom, firstChildren);
  }
}

function fetchCss(): Promise<string> {
  return new Promise((resolve, reject) => {
    const append = getGlobalOptions('appended');
    if (append) {
      setGlobalOptions('appended', false);
      resolve('');
      return;
    }

    const xhr = new XMLHttpRequest();
    xhr.onload = function () {
      if (xhr.readyState === 4) {
        if (xhr.status === 200) {
          resolve(xhr.responseText);
        } else {
          reject(xhr.status);
        }
      }
    };
    xhr.onerror = function (e) {
      reject(e);
    };
    xhr.ontimeout = function (e) {
      reject(e);
    };
    xhr.open('GET', outputFileName, true);
    xhr.send();
  });
}
