export function folderExists (tree, path) {
  if (!Array.isArray(path) || !path.every(part => typeof part === 'string' && part.length > 0)) return false
  let children = tree
  for (const title of path) {
    const folder = children.find(item => item.type === 'folder' && item.title === title)
    if (!folder || !Array.isArray(folder.children)) return false
    children = folder.children
  }
  return true
}

export function initialWorkFolder (tree, savedPath, preferredPath) {
  if (folderExists(tree, savedPath)) return savedPath.slice()
  if (preferredPath?.length && folderExists(tree, preferredPath)) return preferredPath.slice()
  const path = []
  let children = tree
  while (children.length === 1 && children[0].type === 'folder') {
    path.push(children[0].title)
    children = children[0].children || []
  }
  return path
}

export function workFolderStorageKey (userName, workId) {
  return `work_default_folder:${JSON.stringify([userName, String(workId)])}`
}
