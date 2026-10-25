/**
 * Deutscher Satztrenner mit Abkürzungsliste (SPEC §5.2, Schritt 3).
 * Die Satzgrenzen sind später die Grundlage für das Vorlesen.
 */

/** Abkürzungen ohne Punkt, kleingeschrieben. Mehrteilige („z. B.“) stehen als Einzelteile drin. */
// prettier-ignore
const ABBREVIATIONS = new Set(
  [
    'z', 'b', 'd', 'h', 'u', 'a', 'v', 'o', 'g', 'e', 'i', 's', 'w', 'ä', 'ö', 'ü',
    'bzw', 'ca', 'dr', 'prof', 'nr', 'st', 'str', 'mio', 'mrd', 'tsd', 'jh', 'jhd', 'abs',
    'etc', 'usw', 'evtl', 'ggf', 'inkl', 'exkl', 'max', 'min', 'tel', 'vgl', 'sog',
    'zz', 'zzt', 'hr', 'fr', 'frl', 'jan', 'feb', 'febr', 'mär', 'apr', 'jun', 'jul', 'aug',
    'sep', 'sept', 'okt', 'nov', 'dez', 'mo', 'di', 'mi', 'do', 'sa', 'std', 'sek',
    'bspw', 'insb', 'insbes', 'allg', 'anm', 'bd', 'bzgl', 'dgl', 'dt', 'engl', 'franz',
    'gegr', 'geb', 'gest', 'hl', 'hrsg', 'jr', 'kap', 'lt', 'mind', 'mrd', 'nachf', 'o',
    'od', 'pkt', 'rd', 'reg', 'röm', 'sen', 'sr', 'stv', 'tägl', 'ugs', 'urspr', 'usf',
    'verh', 'verw', 'vors', 'wg', 'zb', 'zit', 'zt', 'ziff', 'ehem', 'erw', 'eig',
    'bzgl', 'gem', 'jhs', 'lfd', 'lkr', 'kr', 'ldkr', 'ing', 'dipl',
    'med', 'phil', 'rer', 'nat', 'jur', 'hon', 'apl', 'univ', 'inh',
    'bzgl', 'ff', 'f', 'p', 's', 'ebd', 'aufl', 'bearb', 'übers', 'mrs', 'mr',
    'vs', 'cf', 'ca', 'n', 'chr', 'ggü', 'zus', 'zw', 'wiss', 'hptst', 'präs',
  ].map((s) => s.normalize('NFC')),
);

/** Wörter, vor denen „3.“ eine Ordnungszahl ist und kein Satzende. */
// prettier-ignore
const ORDINAL_FOLLOWERS = new Set([
  'januar', 'februar', 'märz', 'april', 'mai', 'juni', 'juli', 'august', 'september',
  'oktober', 'november', 'dezember', 'jahrhundert', 'jahrhunderts', 'jahrestag', 'mal',
  'platz', 'liga', 'klasse', 'runde', 'spieltag', 'stock', 'etage', 'lauf', 'satz',
]);

/** Satzende-Kandidat: Satzzeichen, evtl. schließende Anführungen/Klammern, dann Leerraum. */
const BOUNDARY = /([.!?…]+)(["“”»«'’)\]]*)(\s+)/gu;
/** Ein Satz beginnt mit Großbuchstabe, Ziffer oder öffnender Anführung/Klammer. */
const SENTENCE_START = /^["„“»«‚'([]?[\p{Lu}\d]/u;

function lastWord(text: string): string {
  const m = /([\p{L}\d]+)$/u.exec(text);
  return m?.[1] ?? '';
}

function firstWord(text: string): string {
  const m = /^["„“»«‚'([]?([\p{L}]+)/u.exec(text);
  return m?.[1] ?? '';
}

function isNonFinalPeriod(before: string, after: string): boolean {
  const word = lastWord(before);
  if (!word) return false;
  const lower = word.toLowerCase();
  // Einzelner Buchstabe (Initiale, „z.“, „B.“)
  if (/^\p{L}$/u.test(word)) return true;
  if (ABBREVIATIONS.has(lower)) return true;
  // Ordinalzahl: „3. Oktober“, „24. Spieltag“, „1. FC“
  if (/^\d{1,3}$/.test(word)) {
    const next = firstWord(after).toLowerCase();
    if (ORDINAL_FOLLOWERS.has(next)) return true;
    // „1. FC Nürnberg“: Großbuchstaben-Kürzel direkt danach
    if (/^\p{Lu}{2,}$/u.test(firstWord(after))) return true;
  }
  // Römische Zahlen bei Namen („Ludwig II. ließ …“) bleiben unberührt: zu selten, im Zweifel trennen.
  return false;
}

export function splitSentences(input: string): string[] {
  const text = input.replace(/\s+/g, ' ').trim();
  if (!text) return [];
  const sentences: string[] = [];
  let start = 0;
  BOUNDARY.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = BOUNDARY.exec(text)) !== null) {
    const punct = m[1] ?? '';
    const closing = m[2] ?? '';
    const end = m.index + punct.length + closing.length;
    const after = text.slice(m.index + m[0].length);
    if (!SENTENCE_START.test(after)) continue;
    if (punct === '.' && !closing && isNonFinalPeriod(text.slice(start, m.index), after)) continue;
    const sentence = text.slice(start, end).trim();
    if (sentence) sentences.push(sentence);
    start = m.index + m[0].length;
  }
  const rest = text.slice(start).trim();
  if (rest) sentences.push(rest);
  return sentences;
}
