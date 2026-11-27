<template>
  <q-img
    :key="coverUrl"
    :src="coverUrl"
    :ratio="4/3"
    :img-class="imgClass"
    class="cover-sfw-img"
    style="max-width: 560px;"
    transition="fade"
    @mouseover="toggleBlurFlag()"
    @mouseout="toggleBlurFlag()"
  >
    <!-- 左上角：RJ 编号（点击复制，无图标） -->
    <div v-if="showBadges && !$store.state.AudioPlayer.privacyMode" class="absolute-top-left transparent cover-corner-top-left">
      <span
        role="button"
        tabindex="0"
        class="cover-badge cover-badge--code cover-badge--copyable"
        :aria-label="$t('workDetails.copyCode')"
        @click.prevent.stop="copyWorkCode"
        @keydown.enter.prevent.stop="copyWorkCode"
        @keydown.space.prevent.stop="copyWorkCode"
      >
        {{ workCode }}
        <AppTooltip>{{ $t('workDetails.copyCode') }}</AppTooltip>
      </span>
    </div>

    <!-- 右上角：年龄分级（彩色区分）或复用场景的本地歌词 -->
    <div v-if="showBadges && !$store.state.AudioPlayer.privacyMode && (ageBadgeText || (showLyricBadge && lyricList.length > 0))" class="absolute-top-right transparent cover-corner-top-right">
      <span v-if="ageBadgeText" class="cover-badge" :class="ageBadgeClass">
        {{ ageBadgeText }}
      </span>
      <span v-else-if="showLyricBadge && lyricList.length > 0" v-for="lyric in lyricList" :key="lyric" class="cover-badge cover-badge--lyric">
        {{ $t('common.localLyrics') }}
      </span>
    </div>

    <!-- 右下角：发售日 -->
    <div v-if="showBadges && release !== '' && !$store.state.AudioPlayer.privacyMode" class="absolute-bottom-right transparent cover-corner-bottom-right">
      <span class="cover-badge cover-badge--date">
        {{ release }}
      </span>
    </div>

    <!--其他自定义组件-->
    <slot name="cover"></slot>
  </q-img>
</template>

<script>

import { copyToClipboard } from 'quasar'
import { idNumberToCode } from 'src/utils'
import { t } from '../i18n'

export default {
  name: 'CoverSFW',

  props: {
    workid: {
      type: Number,
      required: true
    },
    
    nsfw: {
      type: Boolean,
      default: true
    },

    release: {
      required: true
    },

    lyric_status: { // "" or "local"
      type: String,
      require: true,
    },

    ageRating: {
      type: Boolean,
      default: null
    },

    showLyricBadge: {
      type: Boolean,
      default: true
    },

    showBadges: {
      type: Boolean,
      default: true
    },
  },

  data () {
    return {
      blurFlag: true,
    }
  },

  computed: {
    coverUrl () {
      return this.$store.getters['AudioPlayer/coverUrl'](this.workid)
    },

    workCode () {
      return idNumberToCode(this.workid)
    },

    imgClass () {
      if (this.$q.platform.is.mobile) {
        // 在移动设备上图片直接显示
        return ""
      } else {
        if (!this.nsfw) {
          // 在PC上SFW的图片直接显示
          return ""
        } else {
          // 在PC上NSFW的图片鼠标悬停显示
          return this.blurFlag ? "blur-image" : ""
        }
      }
    },

    lyricList() {
      return this.lyric_status?.includes('local') ? ['local'] : [];
    },

    ageBadgeText () {
      if (this.ageRating === false) return t('workCard.allAges')
      if (this.ageRating === true) return 'R-18'
      return ''
    },

    ageBadgeClass () {
      if (this.ageRating === false) return 'cover-badge--all-ages'
      if (this.ageRating === true) return 'cover-badge--r18'
      return ''
    },
  },

  methods: {
    toggleBlurFlag () {
      this.blurFlag = !this.blurFlag
    },

    async copyWorkCode () {
      try {
        await copyToClipboard(this.workCode)
        this.$q.notify({ message: t('workDetails.codeCopied', { code: this.workCode }), type: 'positive', timeout: 1200 })
      } catch {
        // Ignore clipboard denial silently.
      }
    }
  }
}
</script>

<style scoped lang="scss">
.cover-sfw-img {
  background: var(--kikoeru-inset);
}

.blur-image {
  filter: blur(10px);
}

.cover-corner-top-left,
.cover-corner-top-right,
.cover-corner-bottom-right {
  padding: 8px;
}

.cover-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 22px;
  padding: 0 7px;
  background: rgba(20, 22, 26, 0.8);
  -webkit-backdrop-filter: blur(8px);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 5px;
  color: #fff;
  font-size: 11.5px;
  font-weight: 500;
  line-height: 1;
  box-shadow: none;
  white-space: nowrap;
}

.cover-badge--code,
.cover-badge--date {
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
}

.cover-badge--copyable {
  cursor: pointer;
  user-select: none;
  transition: background-color .15s ease, border-color .15s ease;
}

.cover-badge--copyable:hover {
  background: rgba(34, 38, 46, 0.94);
  border-color: rgba(255, 255, 255, 0.34);
}

.cover-badge--lyric {
  background: rgba(22, 101, 52, 0.86);
  border-color: rgba(134, 239, 172, 0.28);
}

.cover-badge--all-ages {
  background: rgba(22, 101, 52, 0.84);
  border-color: rgba(134, 239, 172, 0.38);
  color: #dcfce7;
}

.cover-badge--r18 {
  background: rgba(153, 27, 27, 0.86);
  border-color: rgba(252, 165, 165, 0.4);
  color: #fee2e2;
}

</style>
