import path from 'path';
import { Plugin } from 'esbuild';
import less from 'less';

/** Less-loader for esbuild */
export const lessLoader = (content, options: Less.Options = {}): Plugin => {
  return {
    name: 'less-loader',
    setup: (build) => {
      build.onResolve({ filter: /\.less$/, namespace: 'file' }, (args) => {
        const filePath = path.resolve(
          process.cwd(),
          path.relative(process.cwd(), args.resolveDir),
          args.path
        );
        return {
          path: filePath,
        };
      });

      // Build .less files
      build.onLoad({ filter: /\.less$/, namespace: 'file' }, async (args) => {
        const dir = path.dirname(args.path);
        try {
          const result = await less.render(content, {
            ...options,
            paths: [...(options.paths || []), dir],
          });

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
