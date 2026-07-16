import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const sourceRoot = path.resolve('src')
const productionRoots = ['pages', 'components'].map((directory) => path.join(sourceRoot, directory))
const bareUseStorePattern = /\buseStore\s*\(\s*\)/g

async function collectTsxFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const nestedFiles = await Promise.all(entries.map((entry) => {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) return collectTsxFiles(entryPath)
    return entry.isFile() && entry.name.endsWith('.tsx') ? [entryPath] : []
  }))
  return nestedFiles.flat()
}

const files = (await Promise.all(productionRoots.map(collectTsxFiles))).flat()
const violations = []

for (const file of files) {
  const source = await readFile(file, 'utf8')
  for (const match of source.matchAll(bareUseStorePattern)) {
    const line = source.slice(0, match.index).split(/\r?\n/).length
    violations.push(`${path.relative(process.cwd(), file)}:${line}`)
  }
}

if (violations.length > 0) {
  console.error('Bare useStore() subscriptions found in production React files:')
  console.error(violations.map((violation) => `- ${violation}`).join('\n'))
  process.exitCode = 1
} else {
  console.log(`Checked ${files.length} production React files: no bare useStore() subscriptions found.`)
}
