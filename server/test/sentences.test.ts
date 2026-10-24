import { describe, expect, it } from 'vitest';
import { splitSentences } from '../src/core/sentences.ts';

describe('splitSentences', () => {
  it('trennt einfache Sätze', () => {
    expect(splitSentences('Es regnet. Die Sonne kommt später! Wirklich?  Ja.')).toEqual([
      'Es regnet.',
      'Die Sonne kommt später!',
      'Wirklich?',
      'Ja.',
    ]);
  });

  it('trennt nicht nach Abkürzungen', () => {
    const text =
      'Es gibt z. B. Äpfel, Birnen usw. Außerdem kam Dr. Muster mit Prof. Beispiel. Danach ging es weiter.';
    expect(splitSentences(text)).toEqual([
      'Es gibt z. B. Äpfel, Birnen usw. Außerdem kam Dr. Muster mit Prof. Beispiel.',
      'Danach ging es weiter.',
    ]);
  });

  it('kennt typische Nachrichten-Abkürzungen', () => {
    expect(splitSentences('Der Bau kostete 1,2 Mio. Euro. Das ist viel.')).toEqual([
      'Der Bau kostete 1,2 Mio. Euro.',
      'Das ist viel.',
    ]);
    expect(splitSentences('Das Haus Nr. 5 steht bzw. stand leer. Jetzt nicht mehr.')).toHaveLength(
      2,
    );
    expect(splitSentences('Das gilt u. a. für Kinder. Und für Ältere.')).toHaveLength(2);
  });

  it('behandelt Ordnungszahlen vor Monaten und Rängen', () => {
    expect(splitSentences('Am 3. Oktober ist Feiertag. Am 24. Dezember auch fast.')).toEqual([
      'Am 3. Oktober ist Feiertag.',
      'Am 24. Dezember auch fast.',
    ]);
    expect(splitSentences('Der Verein steht auf dem 3. Platz. Das freut alle.')).toHaveLength(2);
    expect(splitSentences('Der 1. FC Beispiel gewann. Es war knapp.')).toHaveLength(2);
  });

  it('trennt nach Jahreszahlen am Satzende', () => {
    expect(splitSentences('Das geschah 1990. Danach wurde alles anders.')).toHaveLength(2);
  });

  it('trennt nach Initialen nicht', () => {
    expect(splitSentences('Laut A. Beispiel ist das so. Gut.')).toEqual([
      'Laut A. Beispiel ist das so.',
      'Gut.',
    ]);
  });

  it('berücksichtigt Anführungszeichen', () => {
    expect(splitSentences('„Wir sind froh.“ Das sagte sie. „Kommt ihr?“, fragte er.')).toEqual([
      '„Wir sind froh.“',
      'Das sagte sie.',
      '„Kommt ihr?“, fragte er.',
    ]);
  });

  it('trennt nicht vor Kleinbuchstaben', () => {
    expect(splitSentences('Es war ca. drei Uhr ... und dann? nichts.')).toHaveLength(1);
  });

  it('normalisiert Leerraum und liefert für leeren Text nichts', () => {
    expect(splitSentences('  Ein   Satz\n ohne Ende  ')).toEqual(['Ein Satz ohne Ende']);
    expect(splitSentences('   ')).toEqual([]);
  });
});
