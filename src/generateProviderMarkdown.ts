import fs from 'fs'
import path from 'path'
import { ProviderConfig, ProviderParameter } from './types'

function generateProviderMarkdown(): void {
  const providersDir = path.join(__dirname, 'providers')
  const outputPath = path.join(__dirname, '..', 'Providers.md')

  const providerDirs = fs.readdirSync(providersDir).filter((dir) => {
    const fullPath = path.join(providersDir, dir)
    return fs.statSync(fullPath).isDirectory()
  })

  const configs: ProviderConfig[] = []

  for (const dir of providerDirs) {
    const configPath = path.join(providersDir, dir, 'config.json')
    if (fs.existsSync(configPath)) {
      try {
        const configContent = fs.readFileSync(configPath, 'utf-8')
        const config = JSON.parse(configContent) as ProviderConfig
        if (config.available !== false) configs.push(config)
      } catch (error) {
        console.error(`Failed to read config for ${dir}:`, error)
      }
    }
  }

  configs.sort((a, b) => a.name.localeCompare(b.name))

  let markdown = '# Metadata Providers\n\n'
  markdown += `Total Providers: ${configs.length}\n\n`
  markdown += '## Table of Contents\n\n'

  for (const config of configs) {
    markdown += `- [${config.name}](#${config.id})\n`
  }

  markdown += '\n---\n\n'

  for (const config of configs) {
    markdown += generateProviderSection(config)
  }

  fs.writeFileSync(outputPath, markdown, 'utf-8')
  console.log(`Generated Providers.md with ${configs.length} provider(s)`)
}

function generateProviderSection(config: ProviderConfig): string {
  let section = `## ${config.name}\n\n`
  section += `**ID:** \`${config.id}\`\n\n`
  section += `**Description:** ${config.description}\n\n`
  section += `**Metadata-URL:** [${config.url}](${config.url})\n\n`

  section += '### Parameters\n\n'

  const requiredParams = config.parameters.filter((p) => p.required)
  const optionalParams = config.parameters.filter((p) => !p.required)

  if (requiredParams.length > 0) {
    section += '#### Required Parameters\n\n'
    section += '| Name | Type | Validation | Description |\n'
    section += '|------|------|------------|-------------|\n'
    for (const param of requiredParams) {
      section += `| \`${param.name}\` | ${param.validation.type} | ${formatValidation(param)} | ${param.description || '-'} |\n`
    }
    section += '\n'
  }

  if (optionalParams.length > 0) {
    section += '#### Optional Parameters\n\n'
    section += '| Name | Type | Validation | Description |\n'
    section += '|------|------|------------|-------------|\n'
    for (const param of optionalParams) {
      section += `| \`${param.name}\` | ${param.validation.type} | ${formatValidation(param)} | ${param.description || '-'} |\n`
    }
    section += '\n'
  }

  if (config.parameters.length === 0) {
    section += 'No parameters required.\n\n'
  }

  section += '### Returned Fields\n\n'
  if (config.returnedFields.length > 0) {
    section += config.returnedFields.map((field) => `- \`${field}\``).join('\n')
    section += '\n\n'
  } else {
    section += 'No fields specified.\n\n'
  }

  section += '### Example Request\n\n'
  section += '```\n'
  if (requiredParams.length > 0) {
    const exampleParams = requiredParams.map((p) => `${p.name}:${getExampleValue(p)}`).join('/')
    section += `GET /${config.id}/${exampleParams}/search?title=example&author=author\n`
  } else {
    section += `GET /${config.id}/search?title=example&author=author\n`
  }
  section += '```\n\n'

  if (config.addToAudiobookshelf) {
    section += '### Add to Audiobookshelf\n\n'
    section += '```\n'
    if (requiredParams.length > 0) {
      const exampleParams = requiredParams.map((p) => `${p.name}:${getExampleValue(p)}`).join('/')
      section += `https://provider.vito0912.de/${config.id}/${exampleParams}\n`
    } else {
      section += `https://provider.vito0912.de/${config.id}\n`
    }
    section += '```\n\nUnder "Auth" use `abs`\n\n'
    section += '> The URL can be replaced by your own deployment. The hosted provider can break at any moment.\n\n'
  }

  if (config.comments.length > 0) {
    section += '### Comments\n\n'
    for (const comment of config.comments) {
      section += `- ${comment}\n`
    }
    section += '\n'
  }

  section += '---\n\n'

  return section
}

function formatValidation(param: ProviderParameter): string {
  const val = param.validation

  switch (val.type) {
    case 'enum':
      return val.values ? `[${val.values.join(', ')}]` : '-'
    case 'regex':
      return val.pattern ? `\`${val.pattern}\`` : '-'
    case 'number':
    case 'int':
      if (val.min !== undefined && val.max !== undefined) {
        return `${val.min}-${val.max}`
      } else if (val.min !== undefined) {
        return `≥ ${val.min}`
      } else if (val.max !== undefined) {
        return `≤ ${val.max}`
      }
      return '-'
    case 'string':
      if (val.min !== undefined && val.max !== undefined) {
        return `${val.min}-${val.max} chars`
      } else if (val.min !== undefined) {
        return `≥ ${val.min} chars`
      } else if (val.max !== undefined) {
        return `≤ ${val.max} chars`
      }
      return '-'
    default:
      return '-'
  }
}

function getExampleValue(param: ProviderParameter): string {
  const val = param.validation

  switch (val.type) {
    case 'enum':
      return val.values?.[0] || 'value'
    case 'regex':
      return 'example'
    case 'number':
    case 'int':
      return val.min !== undefined ? String(val.min) : '1'
    case 'string':
      return 'example'
    default:
      return 'value'
  }
}

generateProviderMarkdown()
