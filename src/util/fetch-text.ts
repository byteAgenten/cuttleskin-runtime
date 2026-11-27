/** Loads a text resource (markup, configuration). Rejects on network errors and non-2xx responses. */
export async function fetchText(url: string | URL, init?: RequestInit): Promise<string> {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(
      `Failed to load ${String(url)}: ${String(response.status)} ${response.statusText}`,
    );
  }
  return response.text();
}
