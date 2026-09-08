<template>
  <q-page class="admin-page admin-management-page">
    <header class="settings-heading">
      <h1>{{ $t('folders.title') }}</h1>
    </header>

    <section class="settings-section" aria-labelledby="folders-title">
      <div class="settings-section__heading">
        <q-icon name="folder_open" size="22px" />
        <div>
          <h2 id="folders-title">{{ $t('folders.mediaFolders') }}</h2>
          <div class="text-caption text-grey-7">{{ $t('folders.description') }}</div>
        </div>
      </div>
      <q-form class="library-folder-form" @submit="onSubmitRootFolder">
        <q-input
          outlined dense hide-bottom-space
          v-model="rootFolder.name"
          required lazy-rules
          :rules="[val => !config.rootFolders.find(rootFolder => rootFolder.name === val) || $t('folders.duplicateName')]"
          :label="$t('folders.alias')"
        />
        <q-input
          outlined dense hide-bottom-space
          v-model="rootFolder.path"
          required lazy-rules
          :rules="[val => !config.rootFolders.find(rootFolder => rootFolder.path === val) || $t('folders.duplicatePath')]"
          :label="$t('folders.absolutePath')"
        />
        <q-btn class="settings-action-button" unelevated no-caps type="submit" color="primary" icon="create_new_folder" :label="$t('folders.add')" />
      </q-form>
      <q-list bordered separator class="settings-list">
          <q-item class="settings-row settings-row--action" v-for="(rootFolder, index) in config.rootFolders" :key="rootFolder.name">
            <q-item-section>
              <q-item-label>{{rootFolder.name}}</q-item-label>
              <q-item-label caption>{{rootFolder.path}}</q-item-label>
            </q-item-section>
            <q-item-section side class="settings-control">
              <q-btn outline dense class="settings-icon-button" color="negative" icon="delete_outline" :aria-label="$t('folders.deleteNamed', { name: rootFolder.name })" @click="removeFromRootFolders(index)">
                <q-tooltip>{{ $t('folders.delete') }}</q-tooltip>
              </q-btn>
            </q-item-section>
          </q-item>
          <q-item v-if="!config.rootFolders.length" class="settings-row">
            <q-item-section class="text-grey-7">{{ $t('folders.empty') }}</q-item-section>
          </q-item>
      </q-list>
    </section>

    <LibraryScanner />
  </q-page>
</template>

<script>
import NotifyMixin from '../../mixins/Notification.js'
import LibraryScanner from 'components/LibraryScanner.vue'

export default {
  name: 'Folders',

  components: { LibraryScanner },

  mixins: [NotifyMixin],

  data () {
    return {
      config: {
        rootFolders: []
      },
      rootFolder: {
        name: '',
        path: ''
      },
      loading: false
    }
  },

  methods: {
    requestConfig () {
      this.$axios.get('/api/config/admin')
        .then((response) => {
          this.config = response.data.config
          this.rootFolder.path = response.data.config.voiceWorkDefaultPath
        })
        .catch((error) => {
          if (error.response) {
            // 请求已发出，但服务器响应的状态码不在 2xx 范围内
            if (error.response.status !== 401) {
              this.showErrNotif(error.response.data.error || `${error.response.status} ${error.response.statusText}`)
            }
          } else {
            this.showErrNotif(error.message || error)
          }
        })
    },

    onSubmit () {
      this.loading = true
      this.$axios.put('/api/config/admin', {
        config: this.config
      })
        .then((response) => {
          this.showSuccNotif(response.data.message)
          this.loading = false
        })
        .catch((error) => {
          this.loading = false
          if (error.response) {
            // 请求已发出，但服务器响应的状态码不在 2xx 范围内
            this.showErrNotif(error.response.data.error || `${error.response.status} ${error.response.statusText}`)
          } else {
            this.showErrNotif(error.message || error)
          }
        })
    },

    onSubmitRootFolder () {
      if (this.rootFolder.name !== '' && this.rootFolder.path !== '') {
        this.config.rootFolders.push({
          name: this.rootFolder.name,
          path: this.rootFolder.path
        })
        this.rootFolder.name = ''
        this.rootFolder.path = ''
        this.onSubmit()
      }
    },

    removeFromRootFolders (index) {
      this.config.rootFolders.splice(index, 1)
      this.onSubmit()
    },
  },

  created () {
    this.requestConfig()
  }
}
</script>
