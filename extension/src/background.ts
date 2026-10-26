/**
 * Ersatzweg (SPEC §16.1): Firefox-Menü → Erweiterungen → Augenblick öffnet die Leseansicht,
 * auch wenn die Taste fehlt oder stört.
 */
browser.action.onClicked.addListener((tab) => {
  if (tab.id !== undefined)
    browser.tabs.sendMessage(tab.id, { type: 'augenblick:open' }).catch(() => undefined);
});
