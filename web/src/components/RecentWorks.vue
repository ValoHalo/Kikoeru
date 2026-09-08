<template>
  <div>
    <div class="row items-center justify-between q-mt-lg q-ml-md">
      <div class="col row items-center no-wrap">
        <span class="text-h5 text-weight-regular">{{ $t('recentWorks.title') }}</span>
        <q-btn
          flat
          round
          dense
          class="q-ml-xs"
          :aria-label="$t(expanded ? 'recentWorks.collapse' : 'recentWorks.expand')"
          :aria-expanded="expanded"
          aria-controls="recent-works-list"
          @click="toggleExpanded"
        >
          <q-icon name="expand_more" class="recent-works-chevron" :class="{ 'is-expanded': expanded }" />
          <q-tooltip>{{ $t(expanded ? 'recentWorks.collapse' : 'recentWorks.expand') }}</q-tooltip>
        </q-btn>
      </div>
      <q-btn flat icon="navigate_next" @click="$router.push('/favourites/histroy')"></q-btn>
    </div>
    <div
      id="recent-works-list"
      class="recent-works-collapse"
      :class="{ 'is-expanded': expanded }"
      :inert="!expanded"
      :aria-hidden="!expanded"
      @transitionend.self="onCollapseTransitionEnd"
    >
      <div class="recent-works-collapse-inner">
    <q-virtual-scroll
      class="q-px-sm recent-works-scroll"
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
          class="q-pa-sm"
          style="width: 500px; max-width: 80vw;"
          @click.stop.prevent="resumeThisHistroy(item)"
        >
          <CoverSFW
            class="card q-mx-sm shadow-4"
            :workid="item.id"
            :nsfw="false"
            :release="''"
            :lyric_status="item.lyric_status"
          >
            <template #cover>
              <div class="playInfo absolute-bottom">
                <div class="ellipsis-2-lines audioText">
                  {{ getWorkHistoryInfo(item) }}
                </div>
                <div class="ellipsis workText" >
                  {{ item.title }}
                </div>
              </div>
            </template>
          </CoverSFW>
        </div>
      </template>
    </q-virtual-scroll>
      </div>
    </div>
  </div>
</template>

<script>

import CoverSFW from './CoverSFW.vue';

export default {
  name: 'RecentWorks',

  components: {
    CoverSFW
},

  data () {
    return {
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

  methods: {
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

    async getHistory() {
      if (this.stopLoad || this.isLoading) return;

      this.isLoading = true;

      const params = {
        page: this.pagination.currentPage + 1,
        sort: 'desc',
      };

      // console.warn('load more page on: ', params.page);
      try {
        const response = await this.$axios.get('/api/histroy', { params });
        this.works = this.works.concat(response.data.works);
        this.pagination = response.data.pagination;
        if (this.$refs.scroll) this.$refs.scroll.refresh();
        // console.log("vscroll = ", this.$refs.scroll);
      } catch(err) {
        console.warn('load recent work failed: ', err);
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
      const lastPlayItem = state.queue[state.index]
      return lastPlayItem.title;
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
      console.log(`resume seconds = ${work.state.seconds}`)
    }

  },

  mounted() {
    this.getHistory();
  },
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

.card {
  border-radius: 8px;
  overflow: hidden;
}

.card :deep(.bg-brown) {
  background: rgba(25, 25, 25, 0.8) !important;
  -webkit-backdrop-filter: blur(8px);
  backdrop-filter: blur(8px);
  box-shadow: none;
}

.playInfo {
  background: linear-gradient(to top, black, rgba(0, 0, 0, 0.5), transparent);
  width: 100%;
  padding: 0.5rem;
}

.audioText {
  font-weight: bold;
  font-size: larger;
}

.workText {
  font-weight: normal;
  font-size: small;
  color: lightgrey;

}

.scroll-style-change {
  scrollbar-color: gray transparent;
}

.scroll-style-change::-webkit-scrollbar {
  background: transparent;
  height: 0.5rem;
}

.scroll-style-change::-webkit-scrollbar-thumb {
  background: gray;
  min-width: 3rem;
  border-radius: 10px;
}

</style>
