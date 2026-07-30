### Adding a new provider

1. Create a new folder under `src/providers/` with your provider name
2. Add a `config.json` defining the provider metadata, parameters, and returned fields
3. Create an `index.ts` implementing the `BaseProvider` class
4. The provider will be automatically loaded on startup

Use the `example` provider as a reference template.

**config.json structure:**

```json
{
  "id": "myprovider",
  "name": "My Provider",
  "available": true,
  "addToAudiobookshelf": false,
  "description": "Description of what this provider does",
  "url": "https://example.com",
  "parameters": [
    {
      "name": "limit",
      "required": false,
      "validation": {
        "type": "int",
        "min": 1,
        "max": 20
      },
      "description": "Maximum results to return"
    }
  ],
  "returnedFields": ["title", "author", "cover"],
  "comments": ["Optional notes about the provider"]
}
```

**Provider implementation:**

```typescript
import { BaseProvider } from '../BaseProvider'
import { BookMetadata, ParsedParameters, ProviderConfig } from '../../types'

export default class MyProvider extends BaseProvider {
  constructor(config: ProviderConfig) {
    super(config)
  }

  public async search(title: string, author: string | null, params: ParsedParameters): Promise<BookMetadata[]> {
    return []
  }
}
```
