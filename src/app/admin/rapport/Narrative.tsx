/** La synthèse du rapport : titres « Faits marquants » / « Recommandations », tirets en liste. */
export function Narrative({ text }: { text: string }) {
  const blocks: React.ReactNode[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length) {
      blocks.push(
        <ul key={`l${blocks.length}`} className="ml-5 list-disc space-y-1">
          {list.map((l, i) => <li key={i}>{l}</li>)}
        </ul>,
      );
      list = [];
    }
  };
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    if (/^(faits marquants|recommandations)\s*:?$/i.test(line)) {
      flush();
      blocks.push(<h3 key={`h${blocks.length}`} className="font-display text-base">{line.replace(/:$/, "")}</h3>);
    } else if (line.startsWith("- ")) list.push(line.slice(2));
    else {
      flush();
      blocks.push(<p key={`p${blocks.length}`}>{line}</p>);
    }
  }
  flush();
  return <div className="flex flex-col gap-2 text-sm leading-relaxed">{blocks}</div>;
}
