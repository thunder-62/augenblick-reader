/**
 * Beispielquelle mit selbst geschriebenen Texten (SPEC §12: keine Inhalte Dritter als Testdaten).
 * Für Entwicklung ohne Internet und für die E2E-Tests. Alle Orte, Personen und Ereignisse sind erfunden.
 */
import type { RawArticle, RawItem, SourceAdapter } from './types.ts';

type DemoText = { id: string; section: string; title: string; html: string };

const LONG_PARAGRAPHS = [
  'Am Samstagvormittag hat der Wochenmarkt in Lindenau zum ersten Mal unter dem neuen Glasdach stattgefunden. Rund vierzig Stände boten Obst, Gemüse, Käse und Blumen an, z. B. Äpfel und Kürbisse aus der Region. Viele Besucherinnen und Besucher nutzten das trockene Wetter für einen ausgedehnten Bummel.',
  'Die Stadt hatte das Dach im Frühjahr in Auftrag gegeben. Es soll den Markt vor Regen und starker Sonne schützen. Nach Angaben der Verwaltung kostete der Bau etwa 1,2 Mio. Euro, also weniger als ursprünglich geplant.',
  'Eine Händlerin, die seit über dreißig Jahren Kartoffeln aus eigenem Anbau verkauft, zeigte sich zufrieden. Früher seien an verregneten Tagen kaum Kundinnen gekommen. Jetzt könne man bei jedem Wetter in Ruhe einkaufen.',
];

const DEMO: DemoText[] = [
  {
    id: 'markt',
    section: 'region',
    title: 'Wochenmarkt in Lindenau öffnet unter neuem Dach',
    html: `
      <p>${LONG_PARAGRAPHS[0]}</p>
      <figure><img src="x.jpg" alt=""><figcaption>Bildunterschrift, die entfernt wird.</figcaption></figure>
      <p>${LONG_PARAGRAPHS[1]}</p>
      <h2>Mehr Platz für Sitzbänke</h2>
      <p>${LONG_PARAGRAPHS[2]}</p>
      <p>Unter dem Dach stehen nun auch zwölf neue Sitzbänke. Sie wurden auf Wunsch des Seniorenbeirats aufgestellt. Wer müde wird, kann sich zwischen den Ständen ausruhen, ohne den Markt verlassen zu müssen.</p>
      <p>Der Markt findet weiterhin jeden Mittwoch und Samstag von 7 bis 13 Uhr statt. Am 3. Oktober fällt er wegen des Feiertags aus. Ersatztermin ist wie im vergangenen Jahr der 2. Oktober, also der Tag davor.</p>
      <h2>Kritik an den Parkplätzen</h2>
      <p>Nicht alle sind mit dem Umbau zufrieden. Einige Anwohner bemängeln, dass für das Dach zwanzig Parkplätze weggefallen sind. Die Stadt verweist auf die nahe Bushaltestelle und das neue Parkhaus am Bahnhof.</p>
      <p>Der Bürgermeister kündigte an, die Lage im Herbst zu prüfen. Sollte es Probleme geben, wolle man über zusätzliche Kurzzeitparkplätze in der Nebenstraße sprechen. Eine Entscheidung soll bis Ende des Jahres fallen.</p>
      <p>Mehr zum Thema: <a href="#">Alle Märkte in der Region</a></p>
    `,
  },
  {
    id: 'bibliothek',
    section: 'region',
    title: 'Stadtbibliothek verlängert Öffnungszeiten am Abend',
    html: `
      <p>Die Stadtbibliothek in Lindenau hat ab kommender Woche länger geöffnet. Von Dienstag bis Freitag können Leserinnen und Leser künftig bis 20 Uhr Bücher ausleihen. Bisher schloss das Haus um 18 Uhr.</p>
      <p>Die Leiterin der Bibliothek sagte, viele Berufstätige hätten sich das gewünscht. Auch die Abteilung mit Büchern in großer Schrift werde gut genutzt. Sie solle deshalb im nächsten Jahr erweitert werden.</p>
      <p>Für die längeren Öffnungszeiten werden zwei zusätzliche Stellen geschaffen. Die Kosten trägt die Stadt. Der Eintritt bleibt wie bisher frei.</p>
    `,
  },
  {
    id: 'bahn',
    section: 'inland',
    title: 'Neue Zugverbindung zwischen zwei Landeshauptstädten geplant',
    html: `
      <p>Zwei Bundesländer wollen eine direkte Zugverbindung zwischen ihren Hauptstädten einrichten. Die Fahrt soll künftig knapp zwei Stunden dauern. Heute müssen Reisende mindestens einmal umsteigen.</p>
      <p>Die Verkehrsminister beider Länder unterzeichneten am Freitag eine Absichtserklärung. Die ersten Züge könnten nach ihren Angaben in drei Jahren fahren. Zuvor müssen auf einem Teilstück neue Gleise gebaut werden.</p>
      <p>Fahrgastverbände begrüßten die Pläne. Sie fordern aber, dass die Züge auch an kleineren Bahnhöfen halten. Sonst profitierten vor allem Pendler zwischen den großen Städten.</p>
    `,
  },
  {
    id: 'wetter',
    section: 'inland',
    title: 'Ruhiges Herbstwetter mit viel Sonne erwartet',
    html: `
      <p>Für die kommenden Tage sagen Meteorologen ruhiges Herbstwetter voraus. Tagsüber soll es meist sonnig sein, bei Temperaturen zwischen 12 und 16 Grad. In den Nächten kann es örtlich Bodenfrost geben.</p>
      <p>Am Morgen ist vielerorts mit Nebel zu rechnen. Er löst sich meist bis zum Mittag auf. Autofahrer sollten in den frühen Stunden vorsichtig fahren.</p>
      <p>Erst zum Wochenende wird es wieder wechselhafter. Dann ziehen von Westen Wolken auf, und es kann gelegentlich regnen.</p>
    `,
  },
  {
    id: 'hafen',
    section: 'ausland',
    title: 'Küstenstadt eröffnet erneuerten Hafen für Fischer',
    html: `
      <p>Eine Küstenstadt im Norden Europas hat ihren erneuerten Fischereihafen eingeweiht. Die Kaimauern wurden erhöht, damit Sturmfluten weniger Schaden anrichten. Außerdem gibt es eine neue Halle, in der Fischer ihren Fang direkt verkaufen können.</p>
      <p>Die Bauarbeiten hatten vier Jahre gedauert. Bezahlt wurden sie überwiegend aus einem europäischen Förderprogramm. Die Bürgermeisterin sprach von einem wichtigen Tag für die ganze Region.</p>
      <p>Viele Familien in der Stadt leben seit Generationen vom Fischfang. Sie hoffen, dass der neue Hafen auch jungen Menschen eine Zukunft im Ort bietet.</p>
    `,
  },
  {
    id: 'apfel',
    section: 'wirtschaft',
    title: 'Obstbauern melden gute Apfelernte',
    html: `
      <p>Die Obstbauern in Süddeutschland rechnen in diesem Jahr mit einer guten Apfelernte. Nach einem milden Frühjahr hätten die Bäume viele Früchte getragen. Die Äpfel seien groß und süß.</p>
      <p>Für Verbraucherinnen und Verbraucher könnten die Preise deshalb etwas sinken. Ein Sprecher des Verbandes sagte, regionale Äpfel seien jetzt auf jedem Wochenmarkt zu finden. Besonders gefragt seien alte Sorten.</p>
      <p>Sorgen bereitet den Betrieben dagegen der Mangel an Erntehelfern. Viele Höfe suchen noch Menschen, die beim Pflücken helfen.</p>
    `,
  },
  {
    id: 'chor',
    section: 'vermischtes',
    title: 'Ältester Chor der Stadt feiert 150. Geburtstag',
    html: `
      <p>Mit einem großen Konzert in der Stadtkirche hat der älteste Chor von Lindenau sein 150-jähriges Bestehen gefeiert. Rund sechzig Sängerinnen und Sänger standen auf der Bühne. Das jüngste Mitglied ist sechzehn, das älteste dreiundneunzig Jahre alt.</p>
      <p>Auf dem Programm standen Volkslieder und Werke aus mehreren Jahrhunderten. Das Publikum dankte mit langem Beifall. Zum Schluss sangen viele Gäste das letzte Lied gemeinsam mit dem Chor.</p>
      <p>Der Chor probt jeden Donnerstagabend im Gemeindehaus. Neue Stimmen sind nach Angaben des Vorstands jederzeit willkommen.</p>
    `,
  },
  {
    id: 'fussball',
    section: 'sport',
    title: 'Heimsieg im Derby vor ausverkauftem Haus',
    html: `
      <p>Der Sportverein aus Lindenau hat das Derby gegen den Nachbarort mit 2:1 gewonnen. Vor ausverkauftem Haus fiel das entscheidende Tor in der letzten Spielminute. Die Mannschaft klettert damit auf den 3. Platz der Tabelle.</p>
      <p>Der Trainer lobte nach dem Spiel den Einsatz seiner Spieler. Man habe bis zum Schluss an den Sieg geglaubt. Am kommenden Sonntag steht das nächste Heimspiel an.</p>
    `,
  },
];

export class DemoAdapter implements SourceAdapter {
  readonly id: string = 'demo';

  constructor(private readonly now: () => Date = () => new Date()) {}

  async fetchList(): Promise<RawItem[]> {
    const base = this.now().getTime();
    return DEMO.map((d, i) => ({
      id: d.id,
      url: `https://example.org/beispiel/${d.id}`,
      title: d.title,
      publishedAt: new Date(base - (i + 1) * 20 * 60 * 1000).toISOString(),
      section: d.section,
      payload: d,
    }));
  }

  async fetchArticle(item: RawItem): Promise<RawArticle> {
    const d = item.payload as DemoText;
    return {
      originalId: d.id,
      sourceUrl: item.url,
      lang: 'de',
      section: d.section,
      title: d.title,
      publishedAt: item.publishedAt,
      html: d.html,
    };
  }
}
