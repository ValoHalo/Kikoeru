<template>
  <section class="recent-works" :class="{ 'recent-works--dark': $q.dark.isActive }" aria-labelledby="recent-works-title">
    <header class="recent-works-toolbar">
      <div class="recent-works-heading">
        <q-icon name="history" size="23px" />
        <h2 id="recent-works-title">{{ $t('recentWorks.title') }}</h2>
        <q-btn flat round dense :aria-label="$t(expanded ? 'recentWorks.collapse' : 'recentWorks.expand')" :aria-expanded="expanded" aria-controls="recent-works-list" @click="toggleExpanded">
          <q-icon name="expand_more" class="recent-works-chevron" :class="{ 'is-expanded': expanded }" />
          <q-tooltip>{{ $t(expanded ? 'recentWorks.collapse' : 'recentWorks.expand') }}</q-tooltip>
        </q-btn>
      </div>
      <div class="recent-works-actions">
        <q-btn flat no-caps icon="delete_sweep" :label="$t('recentWorks.clear')" :disable="!works.length || isLoading || !$store.state.User.name" :loading="clearing" @click="confirmClear" />
        <q-btn flat no-caps icon="favorite_border" icon-right="chevron_right" :label="$t('common.favourites')" to="/favourites/histroy" class="recent-works-favourites" />
      </div>
    </header>
    <div
      id="recent-works-list"
      class="recent-works-collapse"
      :class="{ 'is-expanded': expanded }"
      :inert="!expanded"
      :aria-hidden="!expanded"
      @transitionend.self="onCollapseTransitionEnd"
    >
      <div class="recent-works-collapse-inner">
    <div v-if="isLoading && !works.length" class="recent-works-placeholder"><q-spinner size="24px" color="primary" /></div>
    <div v-else-if="loadError && !works.length" class="recent-works-placeholder" role="alert"><q-icon name="cloud_off" size="28px" /><span>{{ $t('recentWorks.loadFailed') }}</span><q-btn flat no-caps color="primary" icon="refresh" :label="$t('common.refresh')" @click="resetHistory" /></div>
    <div v-else-if="!works.length" class="recent-works-placeholder"><q-icon name="history" size="28px" /><span>{{ $t('recentWorks.empty') }}</span></div>
    <q-virtual-scroll v-else
      class="recent-works-scroll"
      :class="{'scroll-style-change': !$q.platform.has.touch, 'is-dragging': mouseDrag && mouseDrag.active}"
      :items="works"
      ref="scroll"
      virtual-scroll-horizontal
      @virtual-scroll="onVirtualScroll"
      @wheel.stop.prevent="onMouseWheel"
      @pointerdown="startMouseDrag"
      @pointermove="moveMouseDrag"
      @pointerup="endMouseDrag"
      @pointercancel="endMouseDrag"
      @lostpointercapture="endMouseDrag"
      @pointerleave="leaveMouseDrag"
      @click.capture="onScrollClick"
      @dragstart.prevent
    >
      <template v-slot="{ item }">
        <div
          class="recent-work-item"
        >
          <button class="recent-work-cover" type="button" :aria-label="`${$t('favListItem.resume')} · ${item.title}`" :disabled="!item.state?.queue?.[item.state.index]" @click="resumeThisHistroy(item)">
            <CoverSFW :workid="item.id" :nsfw="false" :release="''" :lyric_status="item.lyric_status">
              <template #cover>
                <div class="recent-work-overlay absolute-bottom">
                  <div class="recent-work-track ellipsis-2-lines">{{ getWorkHistoryInfo(item) }}</div>
                  <div class="recent-work-title ellipsis">{{ item.title }}</div>
                </div>
              </template>
            </CoverSFW>
          </button>
        </div>
      </template>
    </q-virtual-scroll>
      </div>
    </div>
  </section>
</template>

<script>
import { appDialog } from '../utils/appDialog'

import CoverSFW from './CoverSFW.vue';
import { clearPlaybackHistory } from '../utils/playbackHistory.mjs';

export default {
  name: 'RecentWorks',

  components: {
    CoverSFW
},

  data () {
    return {
      active: true,
      requestId: 0,
      loadError: false,
      clearing: false,
      expanded: true,
      currentPage: 0,
      pagination: { currentPage:0, pageSize:12, totalCount:0 },
      works: [],
      stopLoad: false,
      isLoading: false,
      mouseDrag: null,
      suppressMouseClick: false,
    }
  },

  watch: {
    '$store.state.User.name' () { this.resetHistory() },
    '$store.state.AudioPlayer.historySavedRevision' () { if (this.active && !this.clearing) this.resetHistory() },
    '$store.state.AudioPlayer.historyRevision' () { this.resetHistory() }
  },
  methods: {
    confirmClear () {
      appDialog(this.$q, { title: this.$t('recentWorks.clear'), message: this.$t('recentWorks.clearPrompt'), cancel: this.$t('common.cancel'), ok: { label: this.$t('recentWorks.clearConfirm'), color: 'negative' } }).onOk(() => this.clearHistory());
    },
    async clearHistory () {
      this.clearing = true;
      this.$store.commit('AudioPlayer/SET_HISTORY_CLEARING', true);
      try {
        await clearPlaybackHistory(this.$axios);
        this.expanded = true;
        this.$store.commit('AudioPlayer/HISTORY_CLEARED');
        this.$q.notify({ type: 'positive', message: this.$t('recentWorks.cleared') });
      } catch (_) {
        this.$q.notify({ type: 'negative', message: this.$t('recentWorks.clearFailed') });
      } finally {
        this.clearing = false;
        this.$store.commit('AudioPlayer/SET_HISTORY_CLEARING', false);
      }
    },
    resetHistory (preserve = false) {
      this.requestId++;
      if (preserve !== true) this.works = [];
      this.pagination = { currentPage: 0, pageSize: 12, totalCount: 0 };
      this.stopLoad = false;
      this.isLoading = false;
      this.loadError = false;
      if (this.active) this.getHistory(true);
    },
    onCollapseTransitionEnd() {
      if (this.expanded) this.$refs.scroll?.refresh();
    },

    async toggleExpanded() {
      this.expanded = !this.expanded;
      if (this.expanded) {
        await this.$nextTick();
        this.$refs.scroll?.refresh();
      }
    },

    startMouseDrag(event) {
      this.suppressMouseClick = false;
      const element = event.currentTarget;
      if (event.pointerType !== 'mouse' || event.button !== 0 || element.scrollWidth <= element.clientWidth) return;
      if (event.clientY >= element.getBoundingClientRect().top + element.clientHeight) return;
      this.mouseDrag = { pointerId: event.pointerId, startX: event.clientX, scrollLeft: element.scrollLeft, active: false };
    },

    moveMouseDrag(event) {
      const drag = this.mouseDrag;
      if (!drag || drag.pointerId !== event.pointerId) return;
      if (!(event.buttons & 1)) {
        this.endMouseDrag(event);
        return;
      }
      const distance = event.clientX - drag.startX;
      if (!drag.active) {
        if (Math.abs(distance) < 6) return;
        drag.active = true;
        this.suppressMouseClick = true;
        event.currentTarget.setPointerCapture(event.pointerId);
      }
      event.preventDefault();
      event.currentTarget.scrollLeft = drag.scrollLeft - distance;
    },

    endMouseDrag(event) {
      if (!this.mouseDrag || this.mouseDrag.pointerId !== event.pointerId) return;
      this.mouseDrag = null;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    },

    leaveMouseDrag(event) {
      if (this.mouseDrag && !this.mouseDrag.active) this.endMouseDrag(event);
    },

    onScrollClick(event) {
      if (!this.suppressMouseClick || event.detail === 0) return;
      this.suppressMouseClick = false;
      event.preventDefault();
      event.stopPropagation();
    },

    async getHistory(replace = false) {
      if (this.stopLoad || this.isLoading) return;

      this.isLoading = true;
      const requestId = ++this.requestId;

      const params = {
        page: replace ? 1 : this.pagination.currentPage + 1,
        sort: 'desc',
      };

      // console.warn('load more page on: ', params.page);
      try {
        const response = await this.$axios.get('/api/histroy', { params });
        if (requestId !== this.requestId) return;
        this.works = replace ? response.data.works : this.works.concat(response.data.works);
        this.pagination = response.data.pagination;
        if (this.$refs.scroll) this.$refs.scroll.refresh();
        // console.log("vscroll = ", this.$refs.scroll);
      } catch(err) {
        if (requestId !== this.requestId) return;
        this.loadError = true;
      }
      this.isLoading = false;

      if (this.works.length >= this.pagination.totalCount) {
        this.stopLoad = true;
      }
    },

    async onVirtualScroll(details) {
      // console.log('virtual on virtual scroll: ', details.from, '->', details.to, ' index = ', details.index);
      const alreadyScrolledCount = details.index + 1;
      const loadMoreThres = 3; // 当剩余显示的数量小于这个数字时，加载更多播放历史
      if (loadMoreThres > (this.works.length - alreadyScrolledCount)) {
        this.getHistory();
      }
    },

    onMouseWheel(e) {
      // console.log('vmouse wheel = ', e);
      this.$refs.scroll.$el.scrollLeft += (e.deltaX || e.deltaY);
    },

    // 返回单个作品播放历史的简单信息
    getWorkHistoryInfo(work) {
      const state = work.state;
      return state?.queue?.[state.index]?.title || '';
    },

    resumeThisHistroy(work) {
      this.$store.commit('AudioPlayer/SET_QUEUE', {
        workId: work.id,
        queue: work.state.queue,
        index: work.state.index,
        resetPlaying: false,
        resumeHistroySeconds: work.state.seconds,
      })
      if (work.state.playMode) this.$store.commit('AudioPlayer/SET_PLAY_MODE', work.state.playMode)
      if (Object.prototype.hasOwnProperty.call(work.state, 'playbackRate')) this.$store.commit('AudioPlayer/SET_PLAYBACK_RATE', work.state.playbackRate)

    }

  },

  mounted() { this.getHistory(); },
  activated() { this.active = true; this.resetHistory(true); },
  deactivated() { this.active = false; this.requestId++; },
}
</script>

<style scoped lang="scss">
.recent-works-collapse {
  display: grid;
  grid-template-rows: 0fr;
  opacity: 0;
  visibility: hidden;
  transition: grid-template-rows 280ms cubic-bezier(0.22, 1, 0.36, 1),
    opacity 200ms ease, visibility 0s 280ms;
}

.recent-works-collapse.is-expanded {
  grid-template-rows: 1fr;
  opacity: 1;
  visibility: visible;
  transition-delay: 0s;
}

.recent-works-collapse-inner {
  min-height: 0;
  overflow: hidden;
}

.recent-works-collapse-inner > :first-child { margin-top: 16px; }

.recent-works-chevron {
  transition: transform 280ms cubic-bezier(0.22, 1, 0.36, 1);
}

.recent-works-chevron.is-expanded {
  transform: rotate(180deg);
}

@media (prefers-reduced-motion: reduce) {
  .recent-works-collapse,
  .recent-works-chevron {
    transition: none;
  }
}

@media (hover: hover) and (pointer: fine) {
  .recent-works-scroll {
    cursor: grab;
    user-select: none;
  }

  .recent-works-scroll.is-dragging {
    cursor: grabbing;
  }
}

.recent-works {
  --recent-surface: #fff;
  --recent-border: rgba(0, 0, 0, .1);
  --recent-muted: #686b71;
  --recent-inset: #f5f6f7;
  margin: 24px 16px 0;
  padding: 16px;
  border: 1px solid var(--recent-border);
  border-radius: 10px;
  background: var(--recent-surface);
}
.recent-works-toolbar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; }
.recent-works-heading { display: flex; align-items: center; gap: 10px; }
.recent-works-heading > .q-icon { color: var(--kikoeru-accent-text); }
.recent-works-heading h2 { margin: 0; font-size: 22px; line-height: 32px; letter-spacing: 0; font-weight: 500; }
.recent-works-heading .q-btn { color: var(--recent-muted); }
.recent-works-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.recent-works-actions .q-btn { color: var(--recent-muted); min-height: 38px; padding: 6px 12px; border-radius: 6px; }
.recent-works-actions .recent-works-favourites { color: var(--kikoeru-accent-text); background: color-mix(in srgb, var(--q-primary) 10%, transparent); }
.recent-works-actions :deep(.q-icon) { font-size: 19px; }
.recent-works-placeholder { display: flex; align-items: center; gap: 16px; min-height: 100px; padding: 24px; border: 1px solid var(--recent-border); border-radius: 6px; background: var(--recent-inset); color: var(--recent-muted); }
.recent-work-item { width: 328px; max-width: 82vw; padding: 0 14px 6px 0; }
.recent-work-cover { display: block; width: 100%; border: 0; padding: 0; border-radius: 8px; overflow: hidden; background: transparent; color: white; text-align: left; font: inherit; cursor: pointer; }
.recent-work-cover :deep(.q-img) { display: block; }
.recent-work-cover :deep(.bg-brown) { background: rgba(25,25,25,.8) !important; backdrop-filter: blur(8px); box-shadow: none; }
.recent-work-overlay { padding: 28px 12px 12px; background: linear-gradient(transparent, rgba(0,0,0,.8)); }
.recent-work-track { font-size: 14px; font-weight: 600; line-height: 1.6; }
.recent-work-title { margin-top: 4px; color: #ddd; font-size: 12px; }
.recent-work-cover:focus-visible { outline: 2px solid var(--kikoeru-accent-text); outline-offset: -2px; }
.scroll-style-change { scrollbar-color: #888 transparent; scrollbar-width: thin; }
.recent-works.recent-works--dark { --recent-surface: #1b1b1b; --recent-border: rgba(255,255,255,.12); --recent-muted: #aaadb3; --recent-inset: #242426; }
@media (max-width: 699px) {
  .recent-works { margin: 20px 12px 0; padding: 14px 12px; }
  .recent-works-heading h2 { font-size: 20px; }
  .recent-works-actions { width: 100%; justify-content: flex-start; gap: 8px; }
  .recent-works-actions .q-btn { padding: 6px 10px; min-height: 40px; }
  .recent-work-item { width: 290px; }
  .recent-works-placeholder { min-height: 96px; padding: 20px 16px; }
}
</style>
