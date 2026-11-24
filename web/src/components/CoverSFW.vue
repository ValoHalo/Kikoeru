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
    <div v-if="showBadges && !$store.state.AudioPlayer.privacyMode" class="absolute-top-left transparent" style="padding: 0;">
      <q-chip dense square text-color="white" class="q-ma-sm cover-badge cover-badge--code">
        {{ workCode }}
      </q-chip>
    </div>

    <div v-if="showBadges && release !== ''" class="absolute-bottom-right transparent" style="padding: 0px;">
      <q-chip dense square text-color="white" class="q-ma-sm cover-badge cover-badge--date">
        {{release}}
      </q-chip>
    </div>

    <div v-if="showBadges && lyricList.length > 0" class="absolute-top-right transparent" style="padding: 0px;">
      <q-chip v-for="lyric in lyricList" :key="lyric" dense square text-color="white" class="q-ma-sm cover-badge cover-badge--lyric">{{ $t('common.localLyrics') }}</q-chip>
    </div>

    <!-- 标签 -->
    <div v-if="!$store.state.AudioPlayer.privacyMode" class="q-pa-none q-ma-sm absolute-bottom-left transparent tags-panel">
      <router-link
        v-for="tag in tags"
        :key='tag.id'
        :to="`/works?tagId=${tag.id}`"
        >
        <q-chip dense square text-color="white" class="cover-badge cover-badge-tag">
          {{ tag.name }}
        </q-chip>
      </router-link>
    </div>

    <!--其他自定义组件-->
    <slot name="cover"></slot>
  </q-img>
</template>

<script>

import { idNumberToCode } from 'src/utils'

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
    }
  },

  methods: {
    toggleBlurFlag () {
      this.blurFlag = !this.blurFlag
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

.cover-badge {
  background: rgba(20, 22, 26, 0.78) !important;
  -webkit-backdrop-filter: blur(8px);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 5px;
  font-size: 12px;
  font-weight: 500;
  box-shadow: none;
}

.cover-badge--code {
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
}

.cover-badge--lyric {
  background: rgba(22, 101, 52, 0.86) !important;
  border-color: rgba(134, 239, 172, 0.28);
}

.cover-badge-tag {
  margin: 0;
  transition: background-color .16s ease, border-color .16s ease;
}

.tags-panel a:hover .cover-badge-tag {
  background: rgba(36, 40, 48, 0.92) !important;
  border-color: rgba(255, 255, 255, 0.28);
}

.tags-panel {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  opacity: calc(var(--hover-work-card) + var(--active-work-card) + var(--sim-hover-work-card));
  transition: opacity 0.2s;
  padding: 0;
  max-width: calc(100% - 16px);
  background: transparent;
}

</style>
