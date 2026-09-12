let savedList = null

export function rememberWorksScroll (fullPath) {
  savedList = { fullPath, left: window.scrollX, top: window.scrollY }
}

export function getWorksScroll (fullPath) {
  return savedList?.fullPath === fullPath
    ? { left: savedList.left, top: savedList.top }
    : null
}
