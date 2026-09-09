import type { FileNode } from '../types'

export interface NoteLabel {
  title: string
  context: string
  relativePath: string
}

/** Shortest folder suffix that distinguishes equal titles across the whole vault. */
export function buildNoteLabels(files: Pick<FileNode, 'name' | 'path'>[]): Map<string, NoteLabel> {
  const labels = new Map<string, NoteLabel>()
  const groups = new Map<string, string[]>()
  for (const file of files) {
    if (labels.has(file.path)) continue
    const title = withoutExtension(file.name)
    labels.set(file.path, { title, context: '', relativePath: vaultRelativePath(file.path) })
    const key = title.normalize('NFC').toLocaleLowerCase()
    const group = groups.get(key)
    if (group) group.push(file.path)
    else groups.set(key, [file.path])
  }
  for (const paths of groups.values()) {
    if (paths.length < 2) continue
    const folders = paths.map(path => labels.get(path)!.relativePath.split('/').slice(0, -1))
    const counts = new Map<string, number>()
    for (const folder of folders) {
      for (let depth = 1; depth <= folder.length; depth++) {
        const suffix = folder.slice(-depth).join(' / ')
        counts.set(suffix, (counts.get(suffix) ?? 0) + 1)
      }
    }
    paths.forEach((path, index) => {
      const folder = folders[index]
      let context = '/'
      for (let depth = 1; depth <= folder.length; depth++) {
        const suffix = folder.slice(-depth).join(' / ')
        context = counts.get(suffix) === 1 ? suffix : `/ ${suffix}`
        if (counts.get(suffix) === 1) break
      }
      labels.get(path)!.context = context
    })
  }
  return labels
}

export interface WikilinkOption {
  create?: boolean
  context: string
  title: string
  path: string
  target: string
}

export function validNewNoteName(query: string): string | null {
  const name = query.trim().replace(/\.md$/i, '')
  if (!name || name.length > 120 || [...name].some(char => char.charCodeAt(0) < 32 || '<>:"/\\|?*[]#'.includes(char)) || /[. ]$/.test(name) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)) return null
  return name
}

export function nextNewNoteName(query: string, notes: Pick<WikilinkOption, 'title'>[]): string | null {
  const base = validNewNoteName(query)
  if (!base) return null
  const normalize = (name: string) => name.normalize('NFC').toLocaleLowerCase()
  const occupied = new Set(notes.map(note => normalize(note.title)))
  let name = base
  for (let index = 1; occupied.has(normalize(name)); index++) name = `${base}(${index})`
  return validNewNoteName(name)
}

export function vaultRelativePath(path: string): string {
  return path.includes('/') ? path.slice(path.indexOf('/') + 1) : path
}

const withoutExtension = (name: string) => name.replace(/\.md$/i, '')

export function buildWikilinkOptions(files: FileNode[]): WikilinkOption[] {
  const labels = buildNoteLabels(files)
  return files.map(file => {
    const { title, context } = labels.get(file.path)!
    const relative = withoutExtension(vaultRelativePath(file.path))
    const qualified = relative.includes('/') ? relative : `./${relative}`
    return { title, context, path: file.path, target: context ? qualified : title }
  }).filter(option => !/[[\]\n\r]/.test(option.target))
}

export function filterWikilinkOptions(options: WikilinkOption[], query: string, currentPath: string): WikilinkOption[] {
  const normalize = (text: string) => text.normalize('NFC').toLocaleLowerCase()
  const term = normalize(query.trim())
  const rank = (item: WikilinkOption) => normalize(item.title) === term ? 0 : normalize(item.title).startsWith(term) ? 1 : 2
  return options.filter(item => item.path !== currentPath && (normalize(item.title).includes(term) || normalize(vaultRelativePath(item.path)).includes(term)))
    .sort((a, b) => rank(a) - rank(b) || a.title.localeCompare(b.title) || a.path.localeCompare(b.path))
    .slice(0, 20)
}

export function resolveWikilink(files: FileNode[], target: string, currentPath = ''): FileNode | undefined {
  const name = withoutExtension(target)
  if (name.startsWith('./')) return files.find(file => withoutExtension(vaultRelativePath(file.path)) === name.slice(2))
  if (name.includes('/')) return files.find(file => withoutExtension(vaultRelativePath(file.path)) === name)
    ?? files.find(file => withoutExtension(file.path) === name)
  const directory = currentPath.slice(0, currentPath.lastIndexOf('/'))
  return files.find(file => withoutExtension(file.path) === `${directory}/${name}`)
    ?? files.find(file => withoutExtension(vaultRelativePath(file.path)) === name)
    ?? files.find(file => withoutExtension(file.path) === name)
    ?? files.find(file => withoutExtension(file.name) === name)
}
