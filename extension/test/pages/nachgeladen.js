// Testseite: der Artikel kommt erst nach einer halben Sekunde, wie bei Seiten, die nachladen.
const PARAS = [
  'Die kleine Brücke über den Mühlbach ist ab Montag für drei Wochen gesperrt. Arbeiter erneuern das Geländer und den Belag, der an mehreren Stellen gerissen ist.',
  'Fußgänger und Radfahrer werden über die Ringstraße umgeleitet. Der Umweg ist etwa vierhundert Meter lang und gut ausgeschildert, auch für Rollstühle und Kinderwagen.',
  'Die Stadt bittet um Verständnis. Die Arbeiten seien nötig, damit die Brücke noch viele Jahre sicher bleibt, sagt der Leiter des Bauamts bei einem Termin vor Ort.',
  'Wer Fragen zur Umleitung hat, kann sich an das Bürgerbüro im Rathaus wenden. Dort liegen auch Pläne aus, auf denen der Weg genau eingezeichnet ist.',
];
setTimeout(() => {
  const app = document.getElementById('app');
  const article = document.createElement('article');
  const h1 = document.createElement('h1');
  h1.textContent = 'Brücke über den Mühlbach gesperrt';
  article.append(h1);
  for (const text of PARAS) {
    const p = document.createElement('p');
    p.textContent = text;
    article.append(p);
  }
  app.replaceChildren(article);
}, 500);
