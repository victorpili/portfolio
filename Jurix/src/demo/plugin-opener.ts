/** Substituto de `@tauri-apps/plugin-opener` na demo web: abre o link numa nova aba. */
export async function openUrl(url: string | URL): Promise<void> {
  window.open(String(url), "_blank", "noopener,noreferrer");
}
