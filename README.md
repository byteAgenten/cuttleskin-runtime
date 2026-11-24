<img src="https://cuttleskin.com/favicon.svg" alt="cuttleskin" width="72" align="right">

# cuttleskin runtime

JavaScript library that shows a **cuttleskin graphic** – an animated, data-driven SVG such as a
gauge, a clock, a status display or a map – in a web page and drives it with your data. You set
the values of the variables; the runtime rotates, moves, scales, colors, fades and relabels the
elements of the SVG, with smooth transitions where the graphic defines them.

About 40 KB, no dependencies. Create, edit and export the graphics at
[cuttleskin.com](https://cuttleskin.com).

## Files

| File                     | Use                                                          |
| ------------------------ | ------------------------------------------------------------ |
| `dist/cuttleskin.min.js` | classic `<script>` tag; defines the global `cuttleskin`      |
| `dist/cuttleskin.mjs`    | ES module for bundlers and `<script type="module">`          |
| `dist/cuttleskin.d.ts`   | TypeScript declarations                                      |
| `example/`               | a speedometer whose needle follows a slider                  |

Download them from the [latest release](https://github.com/byteAgenten/cuttleskin-runtime/releases/latest)
and host them yourself.

## Quick start

```html
<div id="gauge" style="width: 400px; aspect-ratio: 1"></div>

<script src="cuttleskin.min.js"></script>
<script>
  const container = document.getElementById('gauge');
  const graphic = cuttleskin.create(container);
  graphic.setAssetRoot('assets/'); // images of the export, if any

  graphic.loadUrl('speedometer.svg', 'speedometer.config.json').then(() => {
    graphic.view.zoomToFit();
    new ResizeObserver(() => graphic.view.zoomToFit()).observe(container);
  });

  graphic.setValue('speed', 120);
</script>
```

As an ES module:

```js
import { create } from './cuttleskin.mjs';

const graphic = create(document.getElementById('gauge'));
await graphic.loadUrl('gauge.svg', 'gauge.config.json');
graphic.view.zoomToFit();
```

Serve the page through a web server; pages opened from disk cannot fetch the files. To try the
example: `npx serve .` in this folder, then open `/example/`.

## Documentation

The full guide – loading, values, zoom and panning, images, events, errors, security and the API
reference – is at [cuttleskin.com/docs/runtime](https://cuttleskin.com/docs/runtime).

## Security

The runtime inserts the SVG into your page without cleaning it. Only load graphics you trust, or
sanitize them first (e.g. with DOMPurify) and pass the result to `graphic.load(node, config)`.

## Licence

[MIT](LICENSE) © byteAgenten GmbH. The runtime is distributed minified and obfuscated.
