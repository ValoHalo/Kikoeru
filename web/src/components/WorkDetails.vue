<template>
  <div class="row">
      <CoverSFW 
        class="col q-ma-sm row justify-start shadow-4"
        :workid="metadata.id" 
        :nsfw="false" 
        :release="metadata.release" 
        :lyric_status="metadata.lyric_status"
        style="border-radius: 8px; overflow: hidden;"
      />

    <div class="col-md-6 col-12 q-pa-sm">
      <div class="q-px-sm q-py-none">
        <!-- 标题 -->
        <div class="text-h6 text-weight-regular">
          <router-link :to="`/work/${metadata.id}`" class="text-secondary">
            {{metadata.title}}
          </router-link>
        </div>

        <!-- 社团名 -->
        <div class="text-subtitle1 text-weight-regular">
          <router-link :to="`/works?circleId=${metadata.circle.id}`" class="text-grey">
            {{metadata.circle.name}}
          </router-link>
        </div>

        <!-- 评价&评论 -->
        <div class="row items-center q-gutter-xs">
          <!-- 评价 -->
          <div class="col-auto">
            <q-rating
              v-model="rating"
              @update:model-value="setRating"
              name="rating"
              size="sm"
              :color="userMarked ? 'blue' : 'amber'"
              icon="star_border"
              icon-selected="star"
              icon-half="star_half"
            />

            <!-- 评价分布明细 -->
            <q-tooltip v-if=metadata.rate_count_detail class="text-subtitle1">
              <div>平均: {{metadata.rate_average_2dp}}</div>
              <div v-for="(rate, index) in sortedRatings" :key=index class="row items-center">
                <div class="col"> {{rate.review_point}}星 </div>

                <!-- 评价占比 -->
                <q-linear-progress
                  :model-value="rate.ratio/100"
                  color="amber"
                  track-color="white"
                  style="height: 15px; width: 100px"
                  class="col-auto"
                />

                <div class="col q-mx-sm"> ({{rate.count}}) </div>
              </div>
            </q-tooltip>
          </div>

          <div class="col-auto">
            <span class="text-weight-medium text-body1 text-red">{{metadata.rate_average_2dp}}</span> <span class="text-grey"> ({{metadata.rate_count}})</span>
          </div>

          <!-- 评论数量 -->
          <div class="col-auto q-px-sm">
            <q-icon name="chat" size="xs" /> <span class="text-grey"> ({{metadata.review_count}})</span>
          </div>

          <!-- DLsite链接 -->
          <div class="col-auto">
            <q-icon v-if="!dlsiteCode.startsWith('CC')" name="launch" size="xs" /><a v-if="!dlsiteCode.startsWith('CC')" class="text-blue" :href="`https://www.dlsite.com/home/work/=/product_id/${dlsiteCode}.html`" rel="noreferrer noopener" target="_blank">DLsite</a>
          </div>
        </div>
      </div>

      <!-- 价格&售出数 -->
      <div class="q-pt-sm q-pb-none">
        <span class="q-mx-sm text-weight-medium text-h6 text-red">{{metadata.price}} 日元</span> 售出数: {{metadata.dl_count}}
      </div>

      <!-- 标签 -->
      <div class="q-px-none q-py-sm" v-if="showTags">
        <router-link
          v-for="(tag, index) in metadata.tags"
          :to="`/works?tagId=${tag.id}`"
          :key=index
        >
          <q-chip size="md" class="shadow-4">
            {{tag.name}}
          </q-chip>
        </router-link>
      </div>

      <!-- 声优 -->
      <div class="q-px-none q-pt-sm q-py-sm">
        <router-link
          v-for="(va, index) in metadata.vas"
          :to="`/works?vaId=${va.id}`"
          :key=index
        >
          <q-chip square size="md" class="shadow-4" color="teal" text-color="white" icon="mic">
            {{va.name}}
          </q-chip>
        </router-link>
      </div>

      <div class="work-actions q-mt-sm q-px-xs">
        <div class="work-action-group">
          <q-btn-dropdown dense class="shadow-4" color="cyan" icon="bookmark" label="标记进度">
            <q-list>
              <q-item clickable @click="setProgress('marked')" class="q-pa-xs">
                <q-item-section avatar>
                  <q-avatar icon="headset" v-show="progress === 'marked'" />
                </q-item-section>
                <q-item-section>
                  <q-item-label>想听</q-item-label>
                </q-item-section>
              </q-item>

              <q-item clickable @click="setProgress('listening')" class="q-pa-xs">
                <q-item-section avatar>
                  <q-avatar icon="headset" v-show="progress === 'listening'" />
                </q-item-section>
                <q-item-section>
                  <q-item-label>在听</q-item-label>
                </q-item-section>
              </q-item>
              <q-item clickable @click="setProgress('listened')" class="q-pa-xs">
                <q-item-section avatar>
                  <q-avatar icon="headset" v-show="progress === 'listened'" />
                </q-item-section>
                <q-item-section>
                  <q-item-label>听过</q-item-label>
                </q-item-section>
              </q-item>
              <q-item clickable @click="setProgress('replay')" class="q-pa-xs">
                <q-item-section avatar>
                  <q-avatar icon="headset" v-show="progress === 'replay'" />
                </q-item-section>
                <q-item-section>
                  <q-item-label>重听</q-item-label>
                </q-item-section>
              </q-item>
              <q-item clickable @click="setProgress('postponed')" class="q-pa-xs">
                <q-item-section avatar>
                  <q-avatar icon="headset" v-show="progress === 'postponed'" />
                </q-item-section>
                <q-item-section>
                  <q-item-label>搁置</q-item-label>
                </q-item-section>
              </q-item>
            </q-list>
          </q-btn-dropdown>

          <q-btn dense class="shadow-4" color="cyan" icon="rate_review" label="写评论" @click="showReviewDialog = true" />
          <q-btn
            v-if="metadata.state && playWorkId !== metadata.id"
            dense
            class="shadow-4"
            color="cyan"
            icon="history"
            label="播放历史进度"
            @click="resumeThisHistroy"
          />
        </div>

        <LibraryActions
          inline
          class="work-action-group"
          :work-id="Number(metadata.id)"
          :archived="Boolean(metadata.archived_at)"
          @changed="$emit('reset')"
        />

        <div class="work-action-group">
          <q-btn
            v-if="isAdministrator"
            dense
            class="shadow-4"
            color="cyan"
            icon="edit"
            label="修改作品信息"
            @click="showEditMetaDialog = true"
          />
          <q-btn dense class="shadow-4" color="cyan" icon="sync" label="扫描本地文件" @click="scanWorkFile" />
          <q-btn v-if="metadata.state" dense outline color="negative" icon="delete_sweep" label="删除播放记录" @click="clearThisHistroy">
            <q-tooltip>当历史记录中有已被删除的音频文件，可能会无法正确播放文件，可通过此按钮解决</q-tooltip>
          </q-btn>
        </div>
      </div>

      <WriteReview v-if="showReviewDialog" @closed="processReview" :workid="metadata.id" :metadata="metadata"></WriteReview>
      <q-dialog v-model="showEditMetaDialog">
        <EditMeta
          v-if="showEditMetaDialog"
          :workid="metadata.id"
          :metadata="metadata"
          @saved="processEditMeta"
        />
      </q-dialog>
    </div>
  </div>
</template>

<script>
import CoverSFW from 'components/CoverSFW.vue'
import WriteReview from './WriteReview.vue'
import EditMeta from './EditMeta.vue'
import LibraryActions from './LibraryActions.vue'
import NotifyMixin from '../mixins/Notification.js'
import { mapState } from 'vuex'
import { idNumberToCode } from 'src/utils'

export default {
  name: 'WorkDetails',

  mixins: [NotifyMixin],

  components: {
    CoverSFW,
    WriteReview,
    EditMeta,
    LibraryActions
  },

  props: {
    metadata: {
      type: Object,
      required: true
    }
  },

  data() {
    return {
      rating: 0,
      userMarked: false,
      progress: '',
      showReviewDialog: false,
      showEditMetaDialog: false,
      showTags: true
    }
  },

  computed: {
    sortedRatings: function() {
      function compare(a, b) {
        return (a.review_point > b.review_point) ? -1 : 1;
      }
      return this.metadata.rate_count_detail.slice().sort(compare);
    },
    
    dlsiteCode() {
      return idNumberToCode(this.metadata.id)
    },

    isAdministrator () {
      return this.$store.state.User.canManage === true
    },

    ...mapState('AudioPlayer', [
      'playing',
      'playWorkId'
    ]),
  },

  watch: {
    // 需要用watch因为父component pages/work.vue是先用空值初始化的
    metadata (newMetaData) {
      if (newMetaData.userRating) {
        this.userMarked = true;
        this.rating = newMetaData.userRating;
      } else {
        this.userMarked = false;
        this.rating = newMetaData.rate_average_2dp || 0;
      }
      this.progress = newMetaData.progress;

      // 极个别作品没有标签
      if (newMetaData.tags && newMetaData.tags.length > 0 && newMetaData.tags[0].name === null) {
        this.showTags = false;
      }
    },
  },

  methods: {
    setProgress (newProgress) {
      this.progress = newProgress;
      const submitPayload = {
        'user_name': this.$store.state.User.name, // 用户名不会被后端使用
        'work_id': this.metadata.id,
        'progress': newProgress
      };
      this.submitProgress(submitPayload);
    },

    submitProgress (payload) {
      const params = {
        starOnly: false,
        progressOnly: true
      }
      this.$axios.put('/api/review', payload, {params})
        .then((response) => {
          this.showSuccNotif(response.data.message);
          this.$emit('reset');
        })
        .catch((error) => {
          if (error.response) {
            // 请求已发出，但服务器响应的状态码不在 2xx 范围内
            this.showErrNotif(error.response.data.error || `${error.response.status} ${error.response.statusText}`)
          } else {
            this.showErrNotif(error.message || error)
          }
        })
    },

    setRating (newRating) {
      const submitPayload = {
        'user_name': this.$store.state.User.name, // 用户名不会被后端使用
        'work_id': this.metadata.id,
        'rating': newRating
      };
      this.submitRating(submitPayload);
    },

    submitRating (payload) {
      this.$axios.put('/api/review', payload)
        .then((response) => {
          this.showSuccNotif(response.data.message);
          this.$emit('reset');
        })
        .catch((error) => {
          if (error.response) {
            // 请求已发出，但服务器响应的状态码不在 2xx 范围内
            this.showErrNotif(error.response.data.error || `${error.response.status} ${error.response.statusText}`)
          } else {
            this.showErrNotif(error.message || error)
          }
        })
    },

    processReview () {
      this.showReviewDialog = false;
    },

    processEditMeta () {
      this.showEditMetaDialog = false
      this.$emit('reset')
    },

    resumeThisHistroy() {
      this.$emit("resumeHistroy")
    },

    clearThisHistroy() {
      this.$q.dialog({
        title: '注意',
        message: '确定要删除这个作品的播放历史吗？',
        cancel: "取消",
        ok: "确定"
      }).onOk(async () => {
        this.$axios.delete('/api/histroy', { data: { work_id: this.metadata.id } })
          .then((_) => {
            this.$q.notify("删除历史成功")
          })
          .catch((err) => {
            this.$q.notify("删除历史失败：", err.message)
            console.error(err)
          })
      })
    },

    async scanWorkFile() {
      try {
        const response = await this.$axios.post(`/api/work/scan/${this.metadata.id}`);
        if (response.data.memo) {
          this.$router.go(0);
        }
      } catch(err) {
        console.error(err);
        this.showErrNotif(err.message || err);
      }
    }
  }
}
</script>

<style scoped>
.work-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 14px;
}

.work-action-group {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.work-actions :deep(.q-btn) {
  font-size: 12px;
  min-height: 28px;
  padding: 0 12.6px 0 8.4px;
}

.work-actions :deep(.q-btn .block) {
  font-size: 14px;
  font-weight: 400;
  line-height: 21px;
}

.work-actions :deep(.q-btn .q-icon.on-left) {
  font-size: 21px;
  margin-right: 4.2px;
}
</style>
