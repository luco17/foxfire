import { copyFile, cp, mkdir, rm, stat } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const output = new URL('dist/', root);

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await copyFile(new URL('index.html', root), new URL('index.html', output));
await cp(new URL('src/', root), new URL('src/', output), {
  recursive: true,
  filter: async source => (await stat(source)).isDirectory() || /\.(?:m?js|css)$/.test(source),
});
await cp(new URL('assets/', root), new URL('assets/', output), {
  recursive: true,
  filter: async source => (await stat(source)).isDirectory() || /\.(?:png|jpe?g|gif|webp|avif|svg|ico)$/i.test(source),
});

console.log('Built dist/ with index.html, browser JavaScript/CSS and image assets.');
