/** Replace an exact node path, or descendants when a folder was renamed. */
export function remapGraphPath(path: string, oldPath: string, newPath: string): string {
  return path === oldPath || path.startsWith(`${oldPath}/`)
    ? newPath + path.slice(oldPath.length)
    : path
}

export function remapGraphPositions<T>(positions: Map<string, T>, oldPath: string, newPath: string): Map<string, T> {
  const next = new Map(positions)
  for (const [path, point] of positions) {
    const target = remapGraphPath(path, oldPath, newPath)
    if (target !== path) { next.delete(path); next.set(target, point) }
  }
  return next
}
