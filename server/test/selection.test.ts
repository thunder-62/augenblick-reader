import { describe, expect, it } from 'vitest';
import { DEFAULT_SECTIONS } from '@augenblick/shared';
import { dedupe, isSameStory, signature } from '../src/core/dedupe.ts';
import { selectEdition, type InterestRanker } from '../src/core/selection.ts';
import { makeArticle } from './helpers.ts';

const lead = (s: string) => `${s} Danach folgen weitere selbst geschriebene Sätze zum Thema.`;

describe('Dubletten', () => {
  it('erkennt dieselbe Meldung mit anderer Überschrift', () => {
    const a = signature(
      'Neue Brücke in Beispielstadt freigegeben – Pendler hoffen auf weniger Stau',
    );
    const b = signature(
      'Beispielstadt: Brücke nach Neubau für Verkehr freigegeben, Stau soll sinken',
    );
    expect(isSameStory(a, b)).toBe(true);
  });

  it('hält verschiedene Meldungen auseinander', () => {
    const a = signature('Neue Brücke in Beispielstadt freigegeben');
    const b = signature('Freibad in Musterdorf bekommt neue Rutsche');
    expect(isSameStory(a, b)).toBe(false);
  });

  it('behält die Fassung mit mehr Text', () => {
    const short = makeArticle({
      source: 'tagesschau',
      title: 'Neue Brücke in Beispielstadt freigegeben',
      text: lead('Die neue Brücke in Beispielstadt ist für den Verkehr freigegeben.'),
      wordCount: 200,
    });
    const long = makeArticle({
      source: 'br24',
      title: 'Beispielstadt: Brücke für den Verkehr freigegeben',
      text: lead('In Beispielstadt ist die neue Brücke für den Verkehr freigegeben worden.'),
      wordCount: 500,
    });
    const other = makeArticle({ title: 'Freibad in Musterdorf bekommt neue Rutsche' });
    const result = dedupe([short, other, long]);
    expect(result.map((a) => a.id)).toEqual([long.id, other.id]);
  });
});

describe('selectEdition', () => {
  const many = (section: string, n: number) =>
    Array.from({ length: n }, (_, i) =>
      makeArticle({
        section,
        title: `${section} Meldung ${i} über Thema${section}${i} und Ereignis${i}${section}`,
        text: lead(`Satz über Gegenstand${section}${i} am Ort${i}${section} mit Besonderheit${i}.`),
      }),
    );

  it('mischt nach Rubriken und begrenzt auf 12', () => {
    const candidates = [
      ...many('region', 8),
      ...many('inland', 3),
      ...many('ausland', 3),
      ...many('sport', 5),
      ...many('wissen', 1),
    ];
    const ids = selectEdition(candidates, [], DEFAULT_SECTIONS);
    expect(ids).toHaveLength(12);
    const sections = ids.map((id) => candidates.find((a) => a.id === id)?.section);
    // Quoten zuerst (4/4/2/2, „vermischtes“ hat nur einen Kandidaten), der freie Platz geht an den neuesten Rest.
    expect(sections.filter((s) => s === 'region').length).toBeGreaterThanOrEqual(4);
    expect(sections.filter((s) => s === 'inland' || s === 'ausland').length).toBeGreaterThanOrEqual(
      4,
    );
    expect(sections.filter((s) => s === 'sport').length).toBeGreaterThanOrEqual(2);
    expect(sections.filter((s) => s === 'wissen')).toHaveLength(1);
    // Region kommt zuerst (Reihenfolge des Rubriken-Mix)
    expect(sections[0]).toBe('region');
  });

  it('füllt fehlende Rubriken mit anderen Artikeln auf', () => {
    const candidates = many('region', 10);
    expect(selectEdition(candidates, [], DEFAULT_SECTIONS)).toHaveLength(10);
  });

  it('lässt bestehende Artikel an ihrem Platz und hängt Neues an', () => {
    const existing = many('inland', 2);
    const candidates = [...existing, ...many('region', 3)];
    const ids = selectEdition(candidates, existing, DEFAULT_SECTIONS);
    expect(ids.slice(0, 2)).toEqual(existing.map((a) => a.id));
    expect(ids).toHaveLength(5);
  });

  it('nimmt keine Dublette eines bestehenden Artikels auf', () => {
    const existing = [
      makeArticle({
        title: 'Neue Brücke in Beispielstadt freigegeben',
        text: lead('Brücke Beispielstadt Verkehr freigegeben.'),
      }),
    ];
    const dup = makeArticle({
      section: 'region',
      title: 'Beispielstadt: Brücke für Verkehr freigegeben',
      text: lead('Brücke Beispielstadt Verkehr freigegeben.'),
    });
    expect(selectEdition([dup], existing, DEFAULT_SECTIONS)).toEqual([existing[0]!.id]);
  });
});

describe('selectEdition mit Interessen (SPEC §5.3)', () => {
  const art = (section: string, topic: string, i: number) =>
    makeArticle({
      section,
      topics: [topic],
      title: `${topic} Meldung ${i} über Gegenstand${topic}${i} und Besonderheit${i}${section}`,
      text: lead(`Satz über Ding${topic}${i} am Ort${i}${section} mit Merkmal${topic}${i}.`),
    });
  const ranker = (fav: string): InterestRanker => ({
    score: (a) => (a.topics?.includes(fav) ? 5 : 0),
    favorite: (a) => Boolean(a.topics?.includes(fav)),
  });

  it('die ersten zwei Plätze bleiben redaktionell, danach Lieblingsthemen vorn', () => {
    const candidates = [
      ...Array.from({ length: 4 }, (_, i) => art('region', 'Verkehr', i)),
      ...Array.from({ length: 4 }, (_, i) => art('inland', i < 2 ? 'Garten' : 'Politik', i)),
      ...Array.from({ length: 4 }, (_, i) => art('sport', 'Fußball', i)),
    ];
    const ids = selectEdition(candidates, [], DEFAULT_SECTIONS, 12, ranker('Garten'));
    const plain = selectEdition(candidates, [], DEFAULT_SECTIONS, 12, null);
    expect(ids.slice(0, 2)).toEqual(plain.slice(0, 2));
    const topicAt = (i: number) => candidates.find((a) => a.id === ids[i])?.topics?.[0];
    expect([topicAt(2), topicAt(3)]).toEqual(['Garten', 'Garten']);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('kein Filtern: mindestens 3 Plätze für andere Themen', () => {
    const candidates = [
      ...Array.from({ length: 10 }, (_, i) => art('region', 'Garten', i)),
      ...Array.from({ length: 6 }, (_, i) => art('wissen', 'Technik', i)),
    ];
    const ids = selectEdition(
      candidates,
      [],
      [{ key: 'alles', sections: ['region', 'wissen'], count: 12 }],
      12,
      ranker('Garten'),
    );
    const others = ids.filter(
      (id) => candidates.find((a) => a.id === id)?.topics?.[0] !== 'Garten',
    );
    expect(ids).toHaveLength(12);
    expect(others.length).toBeGreaterThanOrEqual(3);
  });
});
