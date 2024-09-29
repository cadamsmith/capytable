import { defineConfig, Options } from 'tsup';
import { umdWrapper } from 'esbuild-plugin-umd-wrapper';
import { version } from './package.json';

const clientName = 'capytable';

const baseConfig: Options = {
  entry: {
    ['capytable']: 'src/capytable.ts',
  },
  outDir: 'dist',
  outExtension({ format, options }) {
    const ext = { esm: 'js', cjs: 'cjs', umd: 'umd.js' }[format];
    const minExt = { esm: 'min.js', cjs: 'min.cjs', umd: 'umd.min.js' }[format];
    const outputExtension = options.minify ? `${minExt}` : `${ext}`;
    return {
      js: `.${outputExtension}`,
    };
  },
  platform: 'browser',
  format: ['esm'],
  name: clientName,
  globalName: clientName,
  bundle: true,
  esbuildPlugins: [],
  define: {
    __VERSION__: `'${version}'`,
  },
  minify: true,
  sourcemap: true,
  dts: true,
  clean: true,
  esbuildOptions: (options) => {
    options.legalComments = 'inline';
  },
};

export default defineConfig([
  {
    ...baseConfig,
    esbuildPlugins: [],
  },
  {
    ...baseConfig,
    // @ts-ignore
    format: ['umd'],
    esbuildPlugins: [umdWrapper({ external: 'inherit' })],
  },
]);
