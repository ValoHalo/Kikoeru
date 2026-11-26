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
    <div v-if="showBadges && !$store.state.AudioPlayer.privacyMode" class="absolute-top-left transparent cover-corner-top-left">
      <button
        type="button"
        class="cover-badge cover-badge--code cover-badge--copyable"
        :aria-label="$t('workDetails.copyCode')"
        @click.prevent.stop="copyWorkCode"
      >
        <span>{{ workCode }}</span>
        <q-icon name="content_copy" size="11px" class="cover-badge-copy-icon" />
        <AppTooltip>{{ $t('workDetails.copyCode') }}</AppTooltip>
      </button>
    </div>

    <div v-if="showBadges && release !== ''" class="absolute-bottom-right transparent cover-corner-bottom-right">
      <span class="cover-badge cover-badge--date">
        {{ release }}
      </span>
    </div>

    <div v-if="showBadges && lyricList.length > 0" class="absolute-top-right transparent cover-corner-top-right">
      <span v-for="lyric in lyricList" :key="lyric" class="cover-badge cover-badge--lyric">{{ $t('common.localLyrics') }}</span>
    </div>

    <!-- 常驻封面悬浮标签（带独立毛玻璃卡片衬底） -->
    <div v-if="displayedTags.length && !$store.state.AudioPlayer.privacyMode" class="absolute-bottom-left tags-panel">
      <div class="tags-card">
        <router-link
          v-for="tag in displayedTags"
          :key="tag.id"
          :to="`/works?tagId=${tag.id}`"
          class="cover-tag-item"
          @click.stop
        >
          {{ $privateText(tag.name) }}
        </router-link>
        <span v-if="hiddenTagCount > 0" class="cover-tag-item cover-tag-item--more" @click.prevent.stop>
          +{{ hiddenTagCount }}
          <AppTooltip>{{ hiddenTagNames }}</AppTooltip>
        </span>
      </div>
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

    tags: {
      type: Array,
      require: false,
      default() {return [];}
    },

    maxTags: {
      type: Number,
      default: 3
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

    validTags () {
      return (this.tags || []).filter(tag => tag && tag.id != null && tag.name)
    },

    displayedTags () {
      return this.maxTags > 0 ? this.validTags.slice(0, this.maxTags) : this.validTags
    },

    hiddenTagCount () {
      return Math.max(0, this.validTags.length - this.displayedTags.length)
    },

    hiddenTagNames () {
      return this.validTags.slice(this.displayedTags.length).map(tag => this.$privateText(tag.name)).join(' · ')
    }
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

.cover-badge--code {
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
}

.cover-badge--copyable {
  cursor: pointer;
  transition: background-color .15s ease, border-color .15s ease;
}

.cover-badge--copyable:hover {
  background: rgba(34, 38, 46, 0.94);
  border-color: rgba(255, 255, 255, 0.34);
}

.cover-badge-copy-icon {
  opacity: 0.72;
}

.cover-badge--copyable:hover .cover-badge-copy-icon {
  opacity: 1;
}

.cover-badge--lyric {
  background: rgba(22, 101, 52, 0.86);
  border-color: rgba(134, 239, 172, 0.28);
}

.tags-panel {
  padding: 8px;
  max-width: 100%;
  background: transparent;
  pointer-events: none;
}

.tags-card {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 3px;
  max-width: 100%;
  padding: 3px 4px;
  border-radius: 5px;
  background: rgba(18, 20, 24, 0.78);
  -webkit-backdrop-filter: blur(10px);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.14);
  pointer-events: auto;
}

.cover-tag-item {
  display: inline-flex;
  align-items: center;
  height: 18px;
  max-width: 120px;
  padding: 0 5px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.92);
  font-size: 10.5px;
  font-weight: 500;
  line-height: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: background-color .14s ease, color .14s ease;
}

a.cover-tag-item:hover {
  background: rgba(255, 255, 255, 0.18);
  color: #fff;
}

.cover-tag-item--more {
  cursor: default;
  color: rgba(255, 255, 255, 0.75);
  font-variant-numeric: tabular-nums;
}

</style>
