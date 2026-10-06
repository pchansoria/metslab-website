"""Fetch public ORCID/Crossref records and render selected publications + paper news.

Corresponding-author roles are not inferred from author position. Last authors
are selected by the lab's requested rule; non-last co-corresponding authors must
be verified and recorded with a source URL in publication-settings.json.
"""
import argparse
import datetime as dt
import html
import json
import re
import time
import urllib.request
import urllib.parse
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def fetch(url):
    for attempt in range(3):
        try:
            request = urllib.request.Request(url, headers={
                'Accept': 'application/json', 'User-Agent': 'METS-Lab-publications/1.0'})
            with urllib.request.urlopen(request, timeout=30) as response:
                return json.load(response)
        except Exception:
            if attempt == 2:
                raise
            time.sleep(2 ** attempt)


def plain(value):
    return html.unescape(re.sub(r'<[^>]+>', '', value or '')).strip()


def crossref_record(doi):
    record = fetch('https://api.crossref.org/works/' + urllib.parse.quote(doi, safe=''))['message']
    dates = record.get('published-online') or record.get('published') or record.get('issued')
    parts = dates['date-parts'][0]
    date = dt.date(*(parts + [1] * (3 - len(parts)))).isoformat()
    return {'doi': doi, 'title': plain(record['title'][0]),
            'authors': [plain(' '.join(filter(None, [a.get('given'), a.get('family')])))
                        or plain(a.get('name')) for a in record.get('author', [])],
            'date': date, 'journal': plain((record.get('container-title') or ['bioRxiv'])[0]),
            'type': record.get('type'),
            'superseded': bool(record.get('relation', {}).get('is-preprint-of'))}


def update_block(path, key, markup):
    text = path.read_text(encoding='utf-8')
    pattern = rf'<!-- {key}:start -->.*?<!-- {key}:end -->'
    replacement = f'<!-- {key}:start -->\n{markup}\n<!-- {key}:end -->'
    text, count = re.subn(pattern, lambda match: replacement, text, flags=re.S)
    if count != 1:
        raise ValueError(f'Expected one {key} block in {path.name}')
    path.write_text(text, encoding='utf-8')


def esc(value):
    return html.escape(value, quote=True)


def date_label(value):
    date = dt.date.fromisoformat(value)
    return f'{date.day} {date:%B %Y}'


def render(records, settings):
    selected = []
    for record in records.values():
        authors = record.get('authors', [])
        if (not authors or record.get('type') not in ('journal-article', 'posted-content')
                or record.get('superseded') or record['date'] > dt.date.today().isoformat()):
            continue
        last = authors[-1].casefold() == settings['name'].casefold()
        source = settings['co_corresponding'].get(record['doi'])
        if last or source:
            selected.append(dict(record, last_author=last, role='Last author' if last else 'Co-corresponding author'))
    selected.sort(key=lambda record: record['date'], reverse=True)
    if not selected:
        raise ValueError('No verified publications; keeping existing site content')
    cards, news = [], []
    for record in selected:
        doi = esc(record['doi'])
        preprint = record['type'] == 'posted-content'
        venue = esc(record['journal']) + (' · Preprint' if preprint else '')
        authors = ', '.join(record['authors'])
        cards.append(f'''<article class="card publication-card">
  <div class="news-meta"><time datetime="{record['date']}">{date_label(record['date'])}</time></div>
  <h3><a href="https://doi.org/{doi}">{esc(record['title'])}</a></h3>
  <p class="publication-authors">{esc(authors)}</p>
  <p><strong>{venue}</strong></p>
  <a class="news-link" href="https://doi.org/{doi}">Read {'preprint' if preprint else 'article'} <span aria-hidden="true">&rarr;</span></a>
</article>''')
        if record['last_author'] and record['date'] >= settings['news_since']:
            # Announcements are dated one day after the first public publication.
            date = (dt.date.fromisoformat(record['date']) + dt.timedelta(days=1)).isoformat()
            if date > dt.date.today().isoformat():
                continue
            override = settings['overrides'].get(record['doi'], {})
            title = override.get('news_title', 'New publication: ' + record['title'])
            text = override.get('news_text', f"Our {'preprint' if preprint else 'article'} “{record['title']}” is now available in {record['journal']}.")
            news.append((date, f'''<article class="card news-card">
  <div class="news-meta"><span class="grant-badge">{'Preprint' if preprint else 'Publication'}</span><time datetime="{date}">{date_label(date)}</time></div>
  <h3>{esc(title)}</h3><p>{esc(text)}</p>
  <a class="news-link" href="https://doi.org/{doi}">Read {'preprint' if preprint else 'article'} <span aria-hidden="true">&rarr;</span></a>
</article>'''))
    update_block(ROOT / 'publications.html', 'publications', '\n'.join(cards))
    # Keep manually authored grant news and merge by date without duplicates.
    index = (ROOT / 'index.html').read_text(encoding='utf-8')
    manual = re.search(r'<!-- grant-news:start -->(.*?)<!-- grant-news:end -->', index, re.S).group(1)
    for card in re.findall(r'<article\b.*?</article>', manual, re.S):
        news.append((re.search(r'datetime="([^"]+)"', card).group(1), card))
    update_block(ROOT / 'index.html', 'news', '\n'.join(card for _, card in sorted(news, key=lambda pair: pair[0], reverse=True)))
    update_block(ROOT / 'index.html', 'latest-publications', '\n'.join(cards[:3]))
    (ROOT / 'data' / 'publications.json').write_text(json.dumps(selected, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    print(f'Rendered {len(selected)} publications and {len(news)} news items')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--offline', action='store_true', help='Render cached records without network')
    args = parser.parse_args()
    settings = json.loads((ROOT / 'data' / 'publication-settings.json').read_text(encoding='utf-8'))
    cache_path = ROOT / 'data' / 'publication-cache.json'
    cache = json.loads(cache_path.read_text(encoding='utf-8')) if cache_path.exists() else {}
    if not args.offline:
        works = fetch(f"https://pub.orcid.org/v3.0/{settings['orcid']}/works")
        dois = set(settings['overrides']) | set(settings['co_corresponding'])
        for group in works['group']:
            for summary in group['work-summary']:
                for identifier in summary.get('external-ids', {}).get('external-id', []):
                    if identifier['external-id-type'] == 'doi':
                        dois.add(identifier['external-id-value'].lower().removeprefix('https://doi.org/'))
        for doi in sorted(dois):
            try:
                record = crossref_record(doi)
            except Exception:
                if doi not in cache:
                    override = settings['overrides'].get(doi, {})
                    if not all(key in override for key in ('title', 'authors', 'date', 'journal', 'type')):
                        raise
                    record = dict(override, doi=doi)
                else:
                    record = cache[doi]
            record.update({key: value for key, value in settings['overrides'].get(doi, {}).items()
                           if not key.startswith('news_')})
            cache[doi] = record
        cache_path.write_text(json.dumps(cache, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    render(cache, settings)


if __name__ == '__main__':
    main()
