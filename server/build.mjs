// Production build: bundle the server into dist/server.js.
// Workspace packages (@everguide/*) are compiled into the bundle because they
// ship TypeScript source; every other npm package stays an external import.
import { build } from 'esbuild'

await build({
  entryPoints: ['src/server.ts'],
  outfile: 'dist/server.js',
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  sourcemap: true,
  logLevel: 'info',
  plugins: [
    {
      name: 'externalize-npm-packages',
      setup(pluginBuild) {
        pluginBuild.onResolve({ filter: /^[^./]/ }, (args) =>
          args.path.startsWith('@everguide/') ? undefined : { external: true },
        )
      },
    },
  ],
})
