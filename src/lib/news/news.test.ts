import { test } from "node:test";
import assert from "node:assert/strict";
import { freshnessBonus, parseFeed, pickGoodNews, positivityScore, toText, type NewsSource } from "./rss.ts";

const RSS = `<?xml version="1.0"?><rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/"><channel><title>Média</title>
<item><title><![CDATA[Le solaire bat un record de production en France]]></title>
<link>https://www.site.fr/solaire</link><pubDate>Thu, 15 Oct 2026 10:00:00 +0000</pubDate>
<description><![CDATA[<p>Les panneaux photovoltaïques ont fourni 20&nbsp;% de l&#8217;électricité.</p>]]></description>
<media:thumbnail url="https://www.site.fr/www.site.fr/img/solaire.jpg"/></item>
<item><title>Incendie : une forêt détruite, deux morts</title><link>https://www.site.fr/feu</link>
<pubDate>Thu, 15 Oct 2026 09:00:00 +0000</pubDate><description>Catastrophe dans le Var.</description></item>
<item><title>Sans date</title><link>https://www.site.fr/x</link></item>
</channel></rss>`;

const ATOM = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><title>Atom</title>
<entry><title>Une coopérative citoyenne inaugure son parc éolien</title>
<link rel="alternate" href="https://atom.fr/eolien"/><published>2026-10-14T08:00:00+02:00</published>
<summary>Les habitants financent la transition.</summary><image>/img/eolien.png</image></entry>
</feed>`;

test("lit un flux RSS : CDATA, entités, image, articles sans date ignorés", () => {
  const items = parseFeed(RSS, "Média", "https://www.site.fr/feed");
  assert.equal(items.length, 2);
  assert.equal(items[0].title, "Le solaire bat un record de production en France");
  assert.equal(items[0].excerpt, "Les panneaux photovoltaïques ont fourni 20 % de l’électricité.");
  assert.equal(items[0].image, "https://www.site.fr/img/solaire.jpg"); // domaine en double corrigé
  assert.equal(items[0].publishedAt, "2026-10-15T10:00:00.000Z");
});

test("lit un flux Atom avec image relative", () => {
  const [item] = parseFeed(ATOM, "Atom", "https://atom.fr/rss");
  assert.equal(item.link, "https://atom.fr/eolien");
  assert.equal(item.image, "https://atom.fr/img/eolien.png");
});

test("note : avancée positive, drame négatif", () => {
  assert.ok(positivityScore("Le solaire bat un record de production", "") > 0);
  assert.ok(positivityScore("Incendie : une forêt détruite, deux morts", "Catastrophe") < 0);
  assert.ok(positivityScore("La Commission cède aux pressions et propose un report d'un an", "") < 0);
  // « courage » ne doit pas être lu comme « rage », ni « processus » comme « procès »
  assert.ok(positivityScore("Le courage d'une coopérative", "un processus citoyen") > 0);
});

test("sélection : seulement les bonnes nouvelles récentes, diversité des médias", () => {
  const sources: NewsSource[] = [
    { id: "a", name: "Média", url: "" },
    { id: "b", name: "Atom", url: "" },
  ];
  const items = [...parseFeed(RSS, "Média", "https://www.site.fr/feed"), ...parseFeed(ATOM, "Atom", "https://atom.fr/rss")];
  const now = new Date("2026-10-16T08:00:00Z");
  const picked = pickGoodNews(items, sources, now);
  assert.deepEqual(picked.map((p) => p.link), ["https://www.site.fr/solaire", "https://atom.fr/eolien"]);

  const later = pickGoodNews(items, sources, new Date("2026-11-30T08:00:00Z"));
  assert.equal(later.length, 0, "les articles de plus de 7 jours sont écartés");

  const one = pickGoodNews(items, sources, now, { perSource: 1, limit: 1 });
  assert.equal(one.length, 1);
});

test("toText retire les balises", () => {
  assert.equal(toText("<p>Bonjour <b>le</b>&amp; monde</p>"), "Bonjour le & monde");
});

test("un article du jour passe devant un meilleur article de la semaine dernière", () => {
  const now = new Date("2026-10-18T10:00:00Z");
  assert.equal(freshnessBonus("2026-10-18T06:00:00Z", now), 4);
  assert.equal(freshnessBonus("2026-10-12T06:00:00Z", now), 0);
  const base = { link: "", excerpt: "", image: null, source: "M" };
  const items = [
    { ...base, link: "vieux", title: "Une forêt restaurée, la biodiversité revient, succès pour la haie", publishedAt: "2026-10-12T08:00:00.000Z" },
    { ...base, link: "frais", title: "Une coopérative citoyenne lance un parc solaire", publishedAt: "2026-10-18T07:00:00.000Z" },
  ];
  const picked = pickGoodNews(items, [{ id: "m", name: "M", url: "" }], now, { limit: 1 });
  assert.equal(picked[0].link, "frais");
});

test("un conseil pratique compte comme bonne nouvelle, sauf s'il annonce un problème", () => {
  assert.ok(positivityScore("DuckDuckGo, Qwant, Ecosia… Quel moteur de recherche choisir pour sortir de Google ?", "") >= 2);
  assert.ok(positivityScore("Comment la sécheresse menace les récoltes", "") < 2);
});
