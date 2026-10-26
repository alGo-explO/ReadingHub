const REQUEST_TIMEOUT_MS = 8000;
const RESULT_LIMIT = 20;

const languageCodes = {
  eng: 'en', spa: 'es', fre: 'fr', ger: 'de', ita: 'it', por: 'pt',
  rus: 'ru', jpn: 'ja', kor: 'ko', chi: 'zh'
};

async function fetchJson(url) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { Accept: 'application/json', 'User-Agent': 'ReadingHub/1.0' },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
      });

      if (!response.ok) {
        const error = new Error(`Book provider returned HTTP ${response.status}`);
        error.status = response.status;
        throw error;
      }

      return await response.json();
    } catch (error) {
      const isTransient = !error.status || error.status >= 500;
      if (attempt === 1 || !isTransient) throw error;
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  }
}

async function searchGoogleBooks(query) {
  if (!process.env.GOOGLE_BOOKS_API_KEY) return null;

  const params = new URLSearchParams({
    q: query,
    maxResults: String(RESULT_LIMIT),
    printType: 'books',
    key: process.env.GOOGLE_BOOKS_API_KEY
  });
  const data = await fetchJson(`https://www.googleapis.com/books/v1/volumes?${params}`);

  return {
    items: data.items || [],
    totalItems: data.totalItems || 0,
    provider: 'google'
  };
}

function normalizeOpenLibraryBook(book) {
  const isbn = book.isbn?.find((value) => value.length === 13) || book.isbn?.[0];
  const language = book.language?.[0];
  const coverUrl = book.cover_i
    ? `https://covers.openlibrary.org/b/id/${book.cover_i}-M.jpg`
    : undefined;

  return {
    id: book.key || `${book.title}-${book.first_publish_year || 'unknown'}`,
    volumeInfo: {
      title: book.title || 'Unknown title',
      authors: book.author_name?.slice(0, 5) || [],
      categories: book.subject?.slice(0, 5) || [],
      description: '',
      industryIdentifiers: isbn ? [{ type: isbn.length === 13 ? 'ISBN_13' : 'ISBN_10', identifier: isbn }] : [],
      publisher: book.publisher?.[0] || '',
      publishedDate: book.first_publish_year ? String(book.first_publish_year) : '',
      pageCount: Number.isInteger(book.number_of_pages_median) ? book.number_of_pages_median : undefined,
      imageLinks: coverUrl ? { thumbnail: coverUrl, smallThumbnail: coverUrl } : undefined,
      language: languageCodes[language] || language || 'en'
    }
  };
}

async function searchOpenLibrary(query) {
  const params = new URLSearchParams({
    q: query,
    limit: String(RESULT_LIMIT),
    fields: 'key,title,author_name,cover_i,first_publish_year,number_of_pages_median'
  });
  const data = await fetchJson(`https://openlibrary.org/search.json?${params}`);

  return {
    items: (data.docs || []).map(normalizeOpenLibraryBook),
    totalItems: data.numFound || 0,
    provider: 'open-library'
  };
}

export async function searchBooks(query) {
  if (process.env.GOOGLE_BOOKS_API_KEY) {
    try {
      return await searchGoogleBooks(query);
    } catch (error) {
      console.warn(`Google Books search failed (${error.status || error.name}); using Open Library`);
    }
  }

  return searchOpenLibrary(query);
}
