import { parseGraphicConfigJson, type ParseResult } from '@cuttleskin/config';
import { fetchText } from '../util/fetch-text';

/**
 * Loads and validates a graphic configuration.
 * Rejects on network errors; JSON and schema problems are returned as `issues`.
 */
export async function loadGraphicConfig(
  url: string | URL,
  init?: RequestInit,
): Promise<ParseResult> {
  return parseGraphicConfigJson(await fetchText(url, init));
}
