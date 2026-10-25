/** Schlichtes Logging nach stdout/stderr – systemd/journald übernimmt Zeitstempel und Ablage. */
export const log = {
  info: (msg: string, extra?: unknown) =>
    console.log(extra === undefined ? msg : `${msg} ${JSON.stringify(extra)}`),
  warn: (msg: string, extra?: unknown) =>
    console.warn(extra === undefined ? msg : `${msg} ${JSON.stringify(extra)}`),
  error: (msg: string, err?: unknown) =>
    console.error(
      err === undefined ? msg : `${msg}: ${err instanceof Error ? err.message : String(err)}`,
    ),
};
