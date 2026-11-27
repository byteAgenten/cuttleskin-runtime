import {
  parseGraphicConfig,
  parseGraphicConfigJson,
  resolveSettings,
  type ConfigIssue,
  type GraphicConfig,
  type Settings,
} from '@cuttleskin/config';
import { GraphicDocument, type DocumentContent } from './document/document';
import type { RuntimeElement } from './runtime/element/element';
import { Runtime } from './runtime/runtime';
import { Scheduler } from './runtime/scheduler';
import type { Variable } from './runtime/variable/variable';
import { fetchText } from './util/fetch-text';
import { createLogger } from './util/logger';
import { Observable, type EventMap } from './util/observable';
import { View } from './view/view';

/**
 * Own events of the graphic. All events of document, view, scheduler, variables, elements and
 * transformations bubble here as `<source>.<event>`, e.g. `variable.change` or `element.click`.
 */
export type GraphicEvents = EventMap & {
  ready: [];
  error: [error: unknown];
};

const log = createLogger('cuttleskin.graphic');

/**
 * An interactive SVG graphic in a container element: loads markup and configuration,
 * connects variables with the SVG and manages the visible area.
 */
export class Graphic extends Observable<GraphicEvents> {
  readonly document: GraphicDocument;
  readonly scheduler: Scheduler;
  readonly view: View;
  readonly runtime: Runtime;
  #settings: Settings;

  /** Replaces the content of `container`. */
  constructor(container: HTMLElement, settings: Partial<Settings> = {}) {
    super();
    this.#settings = resolveSettings(settings);
    this.document = new GraphicDocument(container, this);
    this.scheduler = new Scheduler(this);
    this.view = new View(this.document, this);
    const currentSettings = (): Settings => this.#settings;
    this.runtime = new Runtime({
      scheduler: this.scheduler,
      document: this.document,
      assets: this.document,
      get settings() {
        return currentSettings();
      },
      events: this,
    });
    this.#applySettings();
  }

  get settings(): Settings {
    return this.#settings;
  }

  /** The loaded configuration. */
  get config(): GraphicConfig {
    return this.runtime.config;
  }

  /** Changes settings; `mode` takes effect with the next `load`. */
  setSettings(settings: Partial<Settings>): void {
    this.#settings = resolveSettings({ ...this.#settings, ...settings });
    this.#applySettings();
  }

  /** Root for relative image URLs in markup and configuration, e.g. `assets/`. */
  setAssetRoot(root: string): void {
    this.document.setAssetRoot(root);
  }

  /**
   * URLs of individual images by file name, e.g. `{ "car.png": "/images/3f2a…" }`; they take
   * precedence over the asset root. Set before `load`, so that the markup uses them.
   */
  setAssetUrls(urls: Readonly<Record<string, string>>): void {
    this.document.setAssetUrls(urls);
  }

  /**
   * Loads SVG markup and configuration (JSON text or parsed JSON). Invalid configuration entries are
   * skipped and returned as issues. Emits `ready` on success; on failure emits `error` and throws.
   */
  load(markup: DocumentContent, config: unknown): readonly ConfigIssue[] {
    try {
      const { config: parsed, issues } =
        typeof config === 'string' ? parseGraphicConfigJson(config) : parseGraphicConfig(config);
      for (const issue of issues)
        log.warn(`Invalid configuration at ${issue.path || '/'}: ${issue.message}`);

      if (parsed.settings) this.setSettings(parsed.settings);
      this.document.load(markup);
      this.runtime.load(parsed);
      this.emit('ready');
      return issues;
    } catch (error) {
      log.error('Error initializing graphic', error);
      this.emit('error', error);
      throw error;
    }
  }

  /** Fetches markup and configuration in parallel and loads them; see `load`. */
  async loadUrl(markupUrl: string | URL, configUrl: string | URL): Promise<readonly ConfigIssue[]> {
    let markup: string;
    let config: string;
    try {
      [markup, config] = await Promise.all([fetchText(markupUrl), fetchText(configUrl)]);
    } catch (error) {
      log.error('Could not load graphic files', error);
      this.emit('error', error);
      throw error;
    }
    return this.load(markup, config);
  }

  /** Runtime element for an SVG element ID or node. */
  element(elementOrId: string | SVGGraphicsElement): RuntimeElement | undefined {
    return this.runtime.getElement(elementOrId);
  }

  variable(name: string): Variable | undefined {
    return this.runtime.getVariable(name);
  }

  getValue(name: string): Variable['value'] | undefined {
    return this.runtime.getValue(name);
  }

  setValue(name: string, value: unknown, formattedValue?: string): void {
    this.runtime.setValue(name, value, formattedValue);
  }

  /** Removes the graphic from its container and releases all listeners. */
  override destroy(): void {
    this.view.destroy();
    this.runtime.destroy();
    this.scheduler.destroy();
    this.document.destroy();
    super.destroy();
  }

  #applySettings(): void {
    this.document.contentLayer.style.imageRendering =
      this.#settings.imageRendering === 'speed' ? 'pixelated' : 'auto';
  }
}

/** Creates a graphic in `container`. */
export function create(container: HTMLElement, settings?: Partial<Settings>): Graphic {
  return new Graphic(container, settings);
}
