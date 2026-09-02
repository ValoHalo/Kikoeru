import axios from "axios";
/**
 * 格式化 id，适配 8 位、6 位 id
 * @param {number} id
 * @return {string}
 */
export function formatID(id) {
  if (id >= 1000000) {
    // 大于 7 位数，则补全为 8 位
    id = `0${id}`.slice(-8);
  } else {
    // 否则补全为 6 位
    id = `000000${id}`.slice(-6);
  }

  return id;
}

export const WORK_ID_TYPES = ['RJ', 'BJ', 'VJ', 'CC']
export const WORK_ID_SPLITTER = 1000000000000

export function idNumberToCode(id) {
  const parsedId = Number(id)
  if (!Number.isSafeInteger(parsedId) || parsedId < 0) {
    throw new TypeError(`Invalid work id: ${id}`)
  }
  const typeIndex = Math.floor(parsedId / WORK_ID_SPLITTER)
  const prefix = WORK_ID_TYPES[typeIndex]
  if (!prefix) {
    throw new RangeError(`Unsupported work id type: ${id}`)
  }
  return `${prefix}${formatID(parsedId % WORK_ID_SPLITTER)}`
}

export function codeToIdNumber(code) {
  const normalizedCode = String(code).trim().toUpperCase()
  const prefix = normalizedCode.slice(0, 2)
  const typeIndex = WORK_ID_TYPES.indexOf(prefix)
  const digits = normalizedCode.slice(2)
  if (typeIndex < 0 || !/^\d+$/.test(digits)) {
    throw new TypeError(`Invalid work code: ${code}`)
  }
  const id = typeIndex * WORK_ID_SPLITTER + Number(digits)
  if (!Number.isSafeInteger(id)) {
    throw new RangeError(`Work code is outside the safe integer range: ${code}`)
  }
  return id
}

export function lyricLinesToLrc(lines) {
  if (!Array.isArray(lines)) return ''
  return lines.map(line => {
    const milliseconds = Math.max(0, Number(line.time) || 0)
    const hours = Math.floor(milliseconds / 3600000)
    const minutes = Math.floor(milliseconds / 60000) % 60
    const seconds = Math.floor(milliseconds / 1000) % 60
    const hundredths = Math.floor(milliseconds % 1000 / 10)
    const minuteField = hours > 0
      ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
      : String(minutes).padStart(2, '0')
    const timestamp = `${minuteField}:${String(seconds).padStart(2, '0')}.${String(hundredths).padStart(2, '0')}`
    const text = String(line.text || '').replace(/\r?\n/g, ' ')
    return `[${timestamp}]${text}`
  }).join('\n')
}

export function dataUrlToBlob(dataUrl, mimeType = 'image/jpeg') {
  const prefix = `data:${mimeType};base64,`
  const raw = dataUrl.startsWith(prefix) ? dataUrl.slice(prefix.length) : dataUrl
  const binary = atob(raw)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index)
  }
  return new Blob([bytes], { type: mimeType })
}

export function formatSeconds(seconds) {
  let h = Math.floor(seconds / 3600) < 10
    ? '0' + Math.floor(seconds / 3600)
    : Math.floor(seconds / 3600)

  let m = Math.floor((seconds / 60 % 60)) < 10
    ? '0' + Math.floor((seconds / 60 % 60))
    : Math.floor((seconds / 60 % 60))

  let s = Math.floor((seconds % 60)) < 10
    ? '0' + Math.floor((seconds % 60))
    : Math.floor((seconds % 60))

  return h === "00"
    ? m + ":" + s
    : h + ":" + m + ":" + s
}

// 解决字符串到正则当中的问题
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // $& means the whole matched string
}

export function extname(string) {
  const extIdx = string.lastIndexOf('.');
  return extIdx >= 0 ? string.substr(extIdx) : "";
}


export const ServerApi = {
  async queryLyric(trackHash, language = 'auto') {
    const response = await axios.get(`/api/media/query-lrc/${trackHash}`, { params: { language } })
    return response.data.lyricList
  },

  async fetchLyric(workId, lyricTrack) {
    const response = await axios.get(`/api/media/fetch-lrc/${lyricTrack.hash}`)
    return response.data.lrc
  },

  async saveLyric(workId, writePath, lines) {
    const response = await axios.post(`/api/media/save-lrc/${workId}`, {
      writePath,
      lrc: lines,
    })
    return response.data
  },

  async askForTranscoding(trackHash, bitRate) {
    const response = await axios.post(`/api/media/pre-transcode/${trackHash}`, {}, {
      params: { bitRate },
    })
    return response.data
  },

  async getTranscodingStatus(trackHash, bitRate) {
    const response = await axios.get(`/api/media/pre-transcode/${trackHash}`, {
      params: { bitRate },
    })
    return response.data
  },

  async getCandidates(type) {
    if (!['circle', 'tag', 'va'].includes(type)) {
      throw new TypeError(`Unsupported metadata candidate type: ${type}`)
    }
    const response = await axios.get(`/api/${type}s`)
    return response.data.slice().sort((a, b) => b.count - a.count)
  },

  async saveEditMeta(workId, metadata) {
    const response = await axios.post(`/api/edit/work/${workId}`, metadata)
    return response.data
  },

  async saveEditImg(workId, dataUrl, type = 'main', filename = 'cover.jpg') {
    const form = new FormData()
    form.append('file', dataUrlToBlob(dataUrl), filename)
    form.append('type', type)
    const response = await axios.post(`/api/edit/img/${workId}`, form, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    return response.data
  },
}

export function getImportantTreePath(tree) {
  if (!Array.isArray(tree)) return []

  const importantFolder = tree.find(item => item.type === 'folder' && item.important)
  if (!importantFolder) return []

  return [
    importantFolder.title,
    ...getImportantTreePath(importantFolder.children)
  ]
}

export function editDistance(s1, s2) {
  s1 = s1.toLowerCase();
  s2 = s2.toLowerCase();

  var costs = new Array();
  for (var i = 0; i <= s1.length; i++) {
    var lastValue = i;
    for (var j = 0; j <= s2.length; j++) {
      if (i == 0)
        costs[j] = j;
      else {
        if (j > 0) {
          var newValue = costs[j - 1];
          if (s1.charAt(i - 1) != s2.charAt(j - 1))
            newValue = Math.min(Math.min(newValue, lastValue),
              costs[j]) + 1;
          costs[j - 1] = lastValue;
          lastValue = newValue;
        }
      }
    }
    if (i > 0)
      costs[s2.length] = lastValue;
  }
  return costs[s2.length];
}

// return [similarity in 0.0~1.0, editDistance]
export function similarity(s1, s2) {
  let longer = s1;
  let shorter = s2;
  if (s1.length < s2.length) {
    longer = s2;
    shorter = s1;
  }
  const longerLength = longer.length;
  if (longerLength == 0) {
    return 1.0;
  }

  const ed = editDistance(longer, shorter);
  return [(longerLength - ed) / parseFloat(longerLength), ed];
}

export function bidirectionSimilarity(s1, s2) {
  let longer = s1;
  let shorter = s2;
  if (s1.length < s2.length) {
    longer = s2;
    shorter = s1;
  }
  const longerLength = longer.length;
  const shorterLength = shorter.length;

  if (longerLength == 0) {
    return 1.0;
  }

  const buf = Array(longerLength).fill(0);
  for (let i = 0; i < shorterLength; ++i) {
    if (longer[i] == shorter[i]) buf[i]++;
    if (longer[longerLength - i - 1] == shorter[shorterLength - i - 1]) buf[longerLength - i]++;
  }

  const samePortion = buf.reduce((acc, x) => acc + (x == 0 ? 0 : 1), 0);
  const value =  samePortion / shorterLength;
  return value;
}

// 多关键字搜索子条件类型
export const AdvanceSearchCondType = {
  UNKNOWN: 0,
  FUZZY: 1, // 全文模糊搜索，包括标题，
  VA: 2,
  TAG: 3,
  CIRCLE: 4,
}
