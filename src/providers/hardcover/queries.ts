export const HARDCOVER_API_URL = 'https://api.hardcover.app/v1/graphql'

export const SEARCH_QUERY = `
query SearchBooks($query: String!, $perPage: Int!, $page: Int!) {
  search(
    query: $query,
    query_type: "Book",
    per_page: $perPage,
    page: $page
  ) {
    ids
  }
}
`

export const BOOK_DETAILS_QUERY = `
query GetBookDetails($ids: [Int!]!) {
  books(where: { id: { _in: $ids } }) {
    id
    slug
    title
    subtitle
    description
    release_year
    release_date
    pages
    audio_seconds
    rating
    ratings_count
    headline
    alternative_titles
    image {
      url
    }
    contributions {
      author {
        id
        name
        slug
      }
      contribution
    }
    book_series {
      series {
        id
        name
        slug
      }
      position
    }
    taggings(limit: 30) {
      tag {
        tag
      }
    }
    default_audio_edition {
      id
      title
      isbn_10
      isbn_13
      release_date
      release_year
      asin
      audio_seconds
      publisher {
        name
      }
      language {
        language
      }
      image {
        url
      }
    }
    editions(limit: 10) {
      id
      reading_format_id
      title
      release_date
      release_year
      pages
      image { url }
      isbn_10
      isbn_13
      asin
      publisher {
        name
      }
      language {
        language
      }
    }
  }
}
`
