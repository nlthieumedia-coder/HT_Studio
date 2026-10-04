export function parseUrlLines(input: string): string[] {
  const seen = new Set<string>();
  const urls: string[] = [];
  const rawMatches = input.match(/(?:https?:\/\/[^\s"'<>\\]+|@[a-zA-Z0-9._]+)/gi) ?? [];
  for (const match of rawMatches) {
    const subUrls = match.split(/(?=https?:\/\/)/i);
    for (let sub of subUrls) {
      const url = sub.trim();
      if (!url || seen.has(url)) continue;
      seen.add(url);
      urls.push(url);
    }
  }
  return urls;
}
