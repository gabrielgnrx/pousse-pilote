import type { NewsItem } from "@/lib/news";
import { relativeTime } from "@/lib/dates";

/** Une bonne nouvelle écologique tirée d'un vrai média, avec lien vers l'article d'origine. */
export function NewsCard({ item }: { item: NewsItem }) {
  return (
    <article className="overflow-hidden rounded-[20px] border-2 border-sauge bg-papier">
      <a href={item.link} target="_blank" rel="noopener noreferrer" className="group block">
        {item.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.image}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            className="h-40 w-full bg-sable object-cover"
          />
        ) : null}
        <div className="flex flex-col gap-2 p-4">
          <div className="flex items-center gap-2">
            <span className="chip bg-sauge text-sapin">
              <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M12 22V11" /><path d="M12 11c0-4 3-7 8-7 0 5-3 7-8 7Z" /><path d="M12 14c0-3-2.5-5.5-7-5.5 0 4 2.5 5.5 7 5.5Z" /></svg>
              Bonne nouvelle
            </span>
            <span className="text-xs text-terre">
              {item.source} · {relativeTime(item.publishedAt)}
            </span>
          </div>
          <h2 className="font-display text-lg leading-snug group-hover:underline">{item.title}</h2>
          {item.excerpt ? <p className="text-sm leading-relaxed text-brun">{item.excerpt}</p> : null}
          <span className="text-sm font-bold text-argile-fonce">
            Lire sur {item.source}
            <span aria-hidden="true"> ↗</span>
            <span className="sr-only"> (nouvel onglet)</span>
          </span>
        </div>
      </a>
    </article>
  );
}
