/**
 * Die wenigen WebExtension-Schnittstellen, die Augenblick für Firefox nutzt (SPEC §16.7).
 * Bewusst knapp statt eines vollständigen Typpakets: was hier fehlt, wird auch nicht benutzt.
 */
declare namespace browser {
  namespace runtime {
    function getURL(path: string): string;
    const onMessage: {
      addListener(cb: (message: unknown, sender: { id?: string }) => void): void;
    };
  }
  namespace tabs {
    function sendMessage(tabId: number, message: unknown): Promise<unknown>;
  }
  namespace action {
    const onClicked: {
      addListener(cb: (tab: { id?: number }) => void): void;
    };
  }
}
