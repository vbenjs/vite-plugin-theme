import path from 'path';
import { Plugin } from 'esbuild';
import less from 'less';
import { PartialMessage } from 'esbuild';

/** Less-loader for esbuild */
export const lessLoader = (content, id, options: Less.Options = {}): Plugin => {
  return {
    name: 'less-loader',
    setup: (build) => {
      // Build .less files
      build.onLoad({ filter: /(\.less$)|(\.vue$)|(\.[t|j]sx$)/, namespace: 'file' }, async () => {
        const dir = path.dirname(id);
        try {
          const result = await less.render(content, options);

          return {
            contents: result.css,
            loader: 'css',
            resolveDir: dir,
          };
        } catch (e) {}
      });
    },
  };
};

export const convertLessError = (error: Less.RenderError): PartialMessage => {
  const sourceLine = error.extract.filter((line) => line);
  const lineText = sourceLine.length === 3 ? sourceLine[1] : sourceLine[0];

  return {
    text: error.message,
    location: {
      namespace: 'file',
      file: error.filename,
      line: error.line,
      column: error.column,
      lineText,
    },
  };
};
