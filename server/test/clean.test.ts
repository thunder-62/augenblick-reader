import { describe, expect, it } from 'vitest';
import { htmlToBlocks, isNoise } from '../src/core/clean.ts';

describe('htmlToBlocks', () => {
  it('behält Absätze und Zwischenüberschriften, entfernt Beiwerk', () => {
    const blocks = htmlToBlocks(`
      <p>Erster Absatz mit <a href="#">einem Link</a> im Satz. Zweiter Satz.</p>
      <figure><img src="a.jpg"><figcaption>Bildunterschrift</figcaption></figure>
      <h2>Zwischentitel</h2>
      <p>Bild: Beispiel</p>
      <p>Noch ein Absatz.</p>
      <script>alert(1)</script>
      <aside>Mehr zum Thema</aside>
      <p><a href="#">Nur ein Link</a></p>
    `);
    expect(blocks).toEqual([
      { type: 'paragraph', sentences: ['Erster Absatz mit einem Link im Satz.', 'Zweiter Satz.'] },
      { type: 'heading', text: 'Zwischentitel' },
      { type: 'paragraph', sentences: ['Noch ein Absatz.'] },
    ]);
  });

  it('überspringt Linklisten unter „Mehr zum Thema“', () => {
    const blocks = htmlToBlocks(`
      <p>Text.</p>
      <h3>Mehr zum Thema</h3>
      <ul><li>Ein Hinweis, der kein Link ist.</li></ul>
      <h2>Weiter im Text</h2>
      <p>Schluss.</p>
    `);
    expect(
      blocks.map((b) =>
        b.type === 'heading' ? b.text : b.type === 'paragraph' ? b.sentences.join(' ') : b.src,
      ),
    ).toEqual(['Text.', 'Weiter im Text', 'Schluss.']);
  });

  it('übernimmt lose Texte und <br> als Absatzgrenze', () => {
    const blocks = htmlToBlocks(
      '<div>Erste Zeile.<br>Zweite Zeile mit <strong>fett</strong>.</div>',
    );
    expect(blocks).toEqual([
      { type: 'paragraph', sentences: ['Erste Zeile.'] },
      { type: 'paragraph', sentences: ['Zweite Zeile mit fett.'] },
    ]);
  });

  it('entfernt Überschriften ohne folgenden Text am Ende', () => {
    const blocks = htmlToBlocks('<p>Text.</p><h2>Rest einer Linkliste</h2>');
    expect(blocks).toHaveLength(1);
  });

  it('dekodiert Entities und entfernt weiche Trennstriche', () => {
    const blocks = htmlToBlocks('<p>Fluss&shy;ufer &amp; Wiese.</p>');
    expect(blocks).toEqual([{ type: 'paragraph', sentences: ['Flussufer & Wiese.'] }]);
  });
});

describe('isNoise', () => {
  it.each([
    'Mehr zum Thema: Verkehr',
    'Über dieses Thema berichtete die Sendung am Montag.',
    'Bild: Beispiel',
    '© Beispiel',
    'Lesen Sie auch: anderes',
  ])('erkennt „%s“', (t) => expect(isNoise(t)).toBe(true));

  it('lässt normalen Text stehen', () =>
    expect(isNoise('Mehr als tausend Menschen kamen.')).toBe(false));
});
