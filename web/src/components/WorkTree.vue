<template>
  <div class="q-ma-md " style="">
    <q-breadcrumbs gutter="xs" v-if="path.length">
      <q-breadcrumbs-el   >
        <q-btn no-caps flat dense size="md" icon="folder" @click="path = []">ROOT</q-btn>
      </q-breadcrumbs-el>
      
      <q-breadcrumbs-el v-for="(folderName, index) in path"  :key="index"  class="cursor-pointer" >
        <q-btn no-caps flat dense size="md" icon="folder" @click="onClickBreadcrumb(index)">{{folderName}}</q-btn>
      </q-breadcrumbs-el>
    </q-breadcrumbs>

    <div class="row justify-end q-mb-sm">
      <q-btn flat round icon="playlist_add" :disable="allAudioTracks.length === 0" aria-label="将整个作品加入已保存列表" @click="openPlaylistPicker(allAudioTracks)"><q-tooltip>将整个作品加入已保存列表</q-tooltip></q-btn>
    </div>

    <q-dialog v-model="showPlaylistPicker">
      <q-card class="playlist-picker-dialog">
        <q-card-section><div class="text-h6">加入已保存列表</div><div class="text-caption text-grey-7">{{ pendingPlaylistTracks.length }} 首曲目</div></q-card-section>
        <q-list v-if="savedPlaylists.length" separator bordered class="scroll" style="max-height: 42vh">
          <q-item v-for="playlist in savedPlaylists" :key="playlist.id" clickable v-ripple @click="addPendingToPlaylist(playlist.id)"><q-item-section avatar><q-icon name="library_music" /></q-item-section><q-item-section><q-item-label>{{ playlist.name }}</q-item-label><q-item-label caption>{{ playlist.item_count }} 首</q-item-label></q-item-section><q-item-section side><q-icon name="add" /></q-item-section></q-item>
        </q-list>
        <q-card-section v-else-if="!loadingPlaylists" class="text-grey text-center">还没有保存的播放列表</q-card-section>
        <q-separator />
        <q-form @submit.prevent="createPlaylistFromPending">
          <q-card-section><q-input v-model.trim="newPlaylistName" outlined dense label="新播放列表名称" maxlength="80" :rules="[value => Boolean(value) || '请输入名称']"><template #append><q-btn flat round dense icon="add" type="submit" :loading="addingToPlaylist" aria-label="新建并加入" /></template></q-input></q-card-section>
        </q-form>
        <q-card-actions align="right"><q-btn flat label="取消" v-close-popup /></q-card-actions>
      </q-card>
    </q-dialog>

    <q-dialog v-model="edit_img">
      <ImageEditor
        v-if="edit_img"
        :src="edit_img_src"
        :work-id="metadata.id"
        @saved="onCoverSaved"
      />
    </q-dialog>

    <q-dialog v-model="preview_img" full-width>
      <q-card v-if="preview_img_list.length">
        <q-card-section>
          <div class="row items-center no-wrap">
            <div class="col">
              <div class="text-h6">{{preview_img_name}}</div>
              <div class="text-subtitle2">{{ preview_img_idx+1 }}/{{ preview_img_list.length }}</div>
            </div>
            <q-btn
              v-if="isAdministrator"
              outline
              class="q-mr-sm"
              label="编辑作为封面"
              @click="editImg(preview_img_list[preview_img_idx])"
            />
            <div v-if="playWorkId > 0" class="col-auto">
              <q-btn outline @click="setVisualPlayerCover(preview_img_list[preview_img_idx])">用作可视化封面</q-btn>
            </div>
          </div>
        </q-card-section>

        <q-card-section class="q-pt-none">
          <q-img style="height: calc(100vh - 200pt);" :src="preview_img_url" contain />
        </q-card-section>

        <q-card-actions align="around">
          <q-btn flat label="上一个" color="primary" @click="changePreviewImg(false)" />
          <q-btn flat label="关闭" color="negative" v-close-popup />
          <q-btn flat label="下一个" color="primary" @click="changePreviewImg(true)" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <q-card>
      <q-list separator>
        <q-item
          clickable
          v-ripple
          v-for="item in fatherFolder"
          :key="item.hash"
          :active="item.type === 'audio' && currentPlayingFile.hash === item.hash"
          active-class="text-white bg-teal"
          @click="onClickItem(item)"
          class="non-selectable"
        >
          <q-item-section avatar style="position: relative;">
            <q-icon size="34px" v-if="item.type === 'folder'" color="amber" name="folder" />
            <q-icon size="34px" v-else-if="item.type === 'text'" color="info" name="description" />
            <q-icon size="34px" v-else-if="item.type === 'image'" color="orange" name="photo" />
            <!-- <q-img width="34px" height="34px" v-else-if="item.type === 'image'" :src="imgSrc(item)" contain :ratio="1/1"  name="thumbnail" /> -->
            <q-icon size="34px" v-else-if="item.type === 'other'" color="info" name="description" />
            <q-btn v-else round dense color="primary" :icon="playIcon(item.hash)" @click="onClickPlayButton(item.hash)" />

          </q-item-section>

          <q-item-section>
            <q-item-label>{{ item.title }}</q-item-label>
            <q-item-label v-if="item.children" caption lines="1">{{ `${item.children.length} 项目` }}</q-item-label>

            <!--音频文件时长-->
            <q-item-label
              v-if="item.type === 'audio' && typeof(item.duration) === 'number'"
              caption
              lines="1"
            >
              <q-icon size="0.8rem" name="schedule" class="q-mr-xs"></q-icon>
              {{ formatSeconds(item.duration) }}
            </q-item-label>
          </q-item-section>

          <!-- 上下文菜单 -->
          <q-menu
            v-if="item.type === 'folder' || item.type === 'audio' || item.type === 'text' || item.type === 'image' || item.type === 'other'"
            touch-position
            context-menu
            auto-close
            transition-show="jump-down"
            transition-hide="jump-up"
          >
            <q-list separator>
              <q-item clickable @click="addToQueue(item)" v-if="item.type === 'audio'">
                <q-item-section>加入当前队列</q-item-section>
              </q-item>

              <q-item clickable @click="playNext(item)" v-if="item.type === 'audio'">
                <q-item-section>下一曲播放</q-item-section>
              </q-item>

              <q-item clickable @click="openPlaylistPicker(item.type === 'folder' ? collectAudioTracks(item.children) : [item])" v-if="item.type === 'folder' || item.type === 'audio'">
                <q-item-section>加入已保存列表</q-item-section>
              </q-item>

              <q-item clickable @click="editImg(item)" v-if="item.type === 'image' && isAdministrator">
                <q-item-section>编辑作为封面</q-item-section>
              </q-item>

              <q-item clickable @click="download(item)" v-if="item.type !== 'folder'">
                <q-item-section>下载文件</q-item-section>
              </q-item>

            </q-list>
          </q-menu>
        </q-item>
      </q-list>
    </q-card>
  </div>
</template>

<script>
import ImageEditor from './ImageEditor.vue'
import { mapState, mapGetters } from 'vuex'
import { formatSeconds } from '../utils'
import NotifyMixin from '../mixins/Notification.js'

export default {
  name: 'WorkTree',
  mixins: [NotifyMixin],

  components: {
    ImageEditor,
  },

  data() {
    return {
      path: [],
      internalTree: [],
      preview_img: false,
      edit_img: false,
      edit_img_src: '',
      preview_img_idx: 0,
      preview_img_list: [],
      preview_img_hash: "",
      showPlaylistPicker: false,
      savedPlaylists: [],
      pendingPlaylistTracks: [],
      newPlaylistName: '',
      loadingPlaylists: false,
      addingToPlaylist: false,
    }
  },

  props: {
    tree: {
      type: Array,
      required: true,
    },
    metadata: {
      type: Object,
      required: true,
    },
    importantTreePathArr: {
      type: Array,
      default: () => [],
    }
  },

  watch: {
    tree (value) {
      this.internalTree = value;
      this.initPath();
    },

    importantTreePathArr (value) {
      if (Array.isArray(value) && value.length > 0) {
        this.path = value.slice()
      }
    }
  },

  computed: {
    isAdministrator () {
      return this.$store.state.User.canManage === true
    },

    fatherFolder () {
      let fatherFolder = this.internalTree.concat()
      this.path.forEach(folderName => {
        fatherFolder = fatherFolder.find(item => item.type === 'folder' && item.title === folderName).children
      })

      return fatherFolder
    },

    queue () {
      const queue = []
      this.fatherFolder.forEach(item => {
        if (item.type === 'audio') {
          queue.push(item)
        }
      })

      return queue
    },

    allAudioTracks () {
      return this.collectAudioTracks(this.internalTree)
    },

    preview_img_url () {
      const item = this.preview_img_list[this.preview_img_idx];
      return item ? this.originalImgSrc(item) : "";
    },

    preview_img_name () {
      const item = this.preview_img_list[this.preview_img_idx];
      return item ? item.title : "";
    },

    ...mapState('AudioPlayer', [
      'playing',
      'playWorkId',
    ]),

    ...mapGetters('AudioPlayer', [
      'currentPlayingFile'
    ])
  },

  methods: {
    formatSeconds,

    collectAudioTracks (items, result = []) {
      for (const item of items || []) {
        if (item.type === 'audio') result.push(item)
        else if (item.type === 'folder' && Array.isArray(item.children)) this.collectAudioTracks(item.children, result)
      }
      return result
    },

    playlistItemFromTrack (track) {
      const workId = Number(track.workId) || Number(String(track.hash || '').split('/')[0]) || Number(this.metadata.id)
      const relativePath = track.relativePath || [track.subtitle, track.title].filter(Boolean).join('/')
      return { workId, relativePath: String(relativePath).replace(/\\/g, '/'), title: track.title, workTitle: track.workTitle || this.metadata.title || '' }
    },

    async openPlaylistPicker (tracks) {
      this.pendingPlaylistTracks = (tracks || []).filter(track => track.type === 'audio')
      if (this.pendingPlaylistTracks.length === 0) return
      this.newPlaylistName = ''
      this.showPlaylistPicker = true
      this.loadingPlaylists = true
      try {
        const response = await this.$axios.get('/api/playlists')
        this.savedPlaylists = response.data.playlists || []
      } catch (error) {
        this.showErrNotif(this.playlistError(error, '读取播放列表失败'))
      } finally {
        this.loadingPlaylists = false
      }
    },

    async addPendingToPlaylist (playlistId) {
      if (this.addingToPlaylist) return
      this.addingToPlaylist = true
      try {
        await this.$axios.post(`/api/playlists/${playlistId}/items`, { items: this.pendingPlaylistTracks.map(track => this.playlistItemFromTrack(track)) })
        this.showPlaylistPicker = false
        this.showSuccNotif(`已加入 ${this.pendingPlaylistTracks.length} 首曲目`)
      } catch (error) {
        this.showErrNotif(this.playlistError(error, '加入播放列表失败'))
      } finally {
        this.addingToPlaylist = false
      }
    },

    async createPlaylistFromPending () {
      if (!this.newPlaylistName || this.addingToPlaylist) return
      this.addingToPlaylist = true
      try {
        await this.$axios.post('/api/playlists', { name: this.newPlaylistName, items: this.pendingPlaylistTracks.map(track => this.playlistItemFromTrack(track)) })
        this.showPlaylistPicker = false
        this.showSuccNotif('播放列表已创建')
      } catch (error) {
        this.showErrNotif(this.playlistError(error, '创建播放列表失败'))
      } finally {
        this.addingToPlaylist = false
      }
    },

    playlistError (error, fallback) {
      return error.response && error.response.data && error.response.data.error ? error.response.data.error : fallback
    },

    playIcon (hash) {
      return this.playing && this.currentPlayingFile.hash === hash ? "pause" : "play_arrow"            
    },

    initPath () {
      const initialPath = []
      let fatherFolder = this.internalTree.concat()
      while (fatherFolder.length === 1) {
        if (fatherFolder[0].type === 'audio') {
          break
        }
        initialPath.push(fatherFolder[0].title)
        fatherFolder = fatherFolder[0].children
      }
      this.path = initialPath
    },
    
    onClickBreadcrumb (index) {
      this.path = this.path.slice(0, index+1)
    },

    onClickItem (item) {
      if (item.type === 'folder') {
        this.path.push(item.title);
      } else if (item.type === 'image') {
        this.openPreviewImg(item);
      } else if (item.type === 'text' || item.type === 'image') {
        this.openFile(item);
      } else if (item.type === 'other') {
        this.download(item);
      } else if (this.currentPlayingFile.hash !== item.hash) {
        this.$store.commit('AudioPlayer/SET_QUEUE', {
          workId: this.metadata.id,
          queue: this.queue.concat(),
          index: this.queue.findIndex(file => file.hash === item.hash),
          resetPlaying: true
        })
      }
    },

    onClickPlayButton (hash) {
      if (this.currentPlayingFile.hash === hash) {
        this.$store.commit('AudioPlayer/TOGGLE_PLAYING')
      } else {
        this.$store.commit('AudioPlayer/SET_QUEUE', {
          workId: this.metadata.id,
          queue: this.queue.concat(),
          index: this.queue.findIndex(file => file.hash === hash),
          resetPlaying: true
        })
      }
    },

    addToQueue (file) {
      this.$store.commit('AudioPlayer/ADD_TO_QUEUE', file)
    },

    playNext (file) {
      this.$store.commit('AudioPlayer/PLAY_NEXT', file)
    },

    download (file) {
      // Fallback to old API for an old backend 
      const url = file.mediaDownloadUrl || `/api/media/download/${file.hash}`;
      const link = document.createElement('a');
      link.href = url;
      link.target="_blank";
      link.click();
    },

    setVisualPlayerCover (imgFile) {
      if (!imgFile) return;
      const urlWithoutToken = imgFile.mediaDownloadUrl ? `${imgFile.mediaDownloadUrl}` : `/api/media/download/${imgFile.hash}`;
      this.$store.commit('AudioPlayer/SET_VISUAL_PLAYER_COVER_URL', urlWithoutToken);
      this.$q.notify({
        message: "封面设置成功",
        actions: [
          { label: "前往大屏页面",
            handler: () => {
              // this.$router.push(`/fullScreenPlayer/${this.playWorkId}`)
              this.$router.push(`/fullScreenPlayer`)
            }
          }
        ],
      });
    },

    openFile (file) {
      // Fallback to old API for an old backend 
      const url = file.mediaStreamUrl || `/api/media/stream/${file.hash}`;
      const link = document.createElement('a');
      link.href = url;
      link.target="_blank";
      link.click();
    },

    imgSrc (imgItem) {
      const url = imgItem.mediaStreamUrl
        ? imgItem.mediaStreamUrl
        : `/api/media/stream/${imgItem.hash}`;
      console.log('imgSrc called for ', imgItem.title);
      return url;
    },

    originalImgSrc (file) {
      // Fallback to old API for an old backend 
      const url = file.mediaStreamUrl || `/api/media/stream/${file.hash}`;
      return url
    },

    openPreviewImg(item) {
      const preview_img_list = this.fatherFolder.filter(item => item.type === 'image')
      let preview_img_idx = -1;
      preview_img_list.forEach((i, idx) => {
        if (i.hash === item.hash) {
          preview_img_idx = idx;
        }
      });
      this.preview_img = true;
      this.preview_img_list = preview_img_list;
      this.preview_img_idx = preview_img_idx;
    },

    changePreviewImg(next) {
      if (this.preview_img_list.length <= 1) return;
      const length = this.preview_img_list.length;
      this.preview_img_idx = (length +this.preview_img_idx + (next ? 1 : -1) ) % length;
    },

    editImg (item) {
      if (!item) return
      this.edit_img_src = this.originalImgSrc(item)
      this.edit_img = true
    },

    onCoverSaved () {
      this.edit_img = false
      this.$router.go(0)
    },
  },
  
  mounted() {
    this.internalTree = this.tree;
    if (this.importantTreePathArr.length > 0) {
      this.path = this.importantTreePathArr.slice()
    }
  }
}
</script>

<style scoped>
.playlist-picker-dialog {
  width: 460px;
  max-width: 92vw;
  max-height: 80vh;
  border-radius: 8px;
}
</style>
