<template>
  <span class="library-actions" @click.stop>
    <template v-if="!dialogOnly">
      <template v-if="inline">
        <q-btn
          dense
          :flat="flat"
          :round="compact"
          :class="{ 'shadow-4': !flat }"
          :color="compact ? undefined : (flat ? 'teal' : 'cyan')"
          icon="create_new_folder"
          :label="compact ? undefined : $t('libraryActions.addToCollection')"
          :aria-label="$t('libraryActions.addToCollection')"
          @click="openCollectionDialog"
        ><AppTooltip v-if="compact">{{ $t('libraryActions.addToCollection') }}</AppTooltip></q-btn>
        <q-btn
          dense
          :flat="flat"
          :round="compact"
          :class="{ 'shadow-4': !flat }"
          :color="compact ? (archived ? 'primary' : undefined) : (flat ? 'teal' : 'cyan')"
          :icon="archived ? 'unarchive' : 'archive'"
          :label="compact ? undefined : (archived ? $t('libraryActions.unarchive') : $t('libraryActions.archive'))"
          :aria-label="archived ? $t('libraryActions.unarchive') : $t('libraryActions.archive')"
          @click="toggleArchive"
        ><AppTooltip v-if="compact">{{ archived ? $t('libraryActions.unarchive') : $t('libraryActions.archive') }}</AppTooltip></q-btn>
      </template>
      <q-btn v-else flat round dense icon="more_vert" :aria-label="$t('libraryActions.organize')" @click="loadCollections">
        <AppTooltip>{{ $t('libraryActions.organize') }}</AppTooltip>
        <q-menu>
          <q-list dense style="min-width: 170px">
            <q-item clickable v-close-popup @click="toggleArchive">
              <q-item-section avatar><q-icon :name="archived ? 'unarchive' : 'archive'" /></q-item-section>
              <q-item-section>{{ archived ? $t('libraryActions.unarchive') : $t('libraryActions.archive') }}</q-item-section>
            </q-item>
            <q-item clickable v-close-popup @click="openCollectionDialog">
              <q-item-section avatar><q-icon name="create_new_folder" /></q-item-section>
              <q-item-section>{{ $t('libraryActions.addToCollection') }}</q-item-section>
            </q-item>
          </q-list>
        </q-menu>
      </q-btn>
    </template>

    <q-dialog v-model="showCollectionDialog">
      <q-card class="library-dialog app-form-dialog">
        <q-card-section class="kikoeru-dialog-header">
          <div class="kikoeru-dialog-title-group">
            <span class="kikoeru-dialog-icon">
              <q-icon name="collections_bookmark" size="18px" />
            </span>
            <div class="kikoeru-dialog-title-text">
              <div class="kikoeru-dialog-title">{{ $t('libraryActions.addToCollection') }}</div>
            </div>
          </div>
          <q-btn flat round dense icon="close" class="kikoeru-dialog-close" :aria-label="$t('common.close')" v-close-popup />
        </q-card-section>

        <q-card-section class="kikoeru-dialog-body library-dialog-body">
          <div class="library-collection-picker">
            <div class="kikoeru-dialog-field-label">{{ $t('libraryActions.selectCollection') }}</div>

            <div v-if="loading" class="library-loading">
              <q-spinner color="primary" size="26px" />
            </div>

            <div v-else-if="collections.length" class="library-collection-list scroll">
              <button
                v-for="item in collections"
                :key="item.id"
                type="button"
                class="library-collection-item"
                :class="{ 'library-collection-item--selected': selectedCollectionId === item.id }"
                @click="selectedCollectionId = item.id"
              >
                <span class="library-collection-item-icon">
                  <q-icon :name="selectedCollectionId === item.id ? 'folder' : 'folder_open'" size="18px" />
                </span>
                <span class="library-collection-item-name">{{ item.name }}</span>
                <span class="library-collection-item-count">{{ item.item_count }}</span>
                <q-icon
                  v-if="selectedCollectionId === item.id"
                  name="check_circle"
                  size="18px"
                  class="library-collection-item-check"
                />
              </button>
            </div>

            <div v-else class="kikoeru-dialog-empty library-empty">
              <span class="kikoeru-dialog-empty-icon">
                <q-icon name="collections_bookmark" size="22px" />
              </span>
              <span>{{ $t('libraryActions.emptyCollections') }}</span>
            </div>
          </div>

          <div class="library-create-section">
            <div class="kikoeru-dialog-field-label">{{ $t('libraryActions.createSection') }}</div>
            <div class="library-create-row">
              <q-input
                v-model.trim="newCollectionName"
                outlined
                dense
                class="library-create-input"
                maxlength="80"
                :placeholder="$t('libraryActions.newCollectionName')"
                @keyup.enter="createCollection"
              />
              <q-btn
                outline
                no-caps
                color="primary"
                icon="add"
                class="library-create-btn"
                :label="$t('common.create')"
                :disable="!newCollectionName || creating"
                :loading="creating"
                @click="createCollection"
              />
            </div>
          </div>
        </q-card-section>

        <q-card-actions class="kikoeru-dialog-footer">
          <q-btn class="app-dialog-cancel" flat no-caps :label="$t('common.cancel')" v-close-popup />
          <q-btn
            unelevated
            no-caps
            color="primary"
            :label="$t('libraryActions.add')"
            :disable="!selectedCollectionId"
            :loading="saving"
            @click="addToCollection"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </span>
</template>

<script>
import { t } from '../i18n'
import NotifyMixin from '../mixins/Notification.js'

export default {
  name: 'LibraryActions',
  mixins: [NotifyMixin],
  props: {
    workId: { type: Number, required: true },
    archived: { type: Boolean, default: false },
    inline: { type: Boolean, default: false },
    flat: { type: Boolean, default: false },
    compact: { type: Boolean, default: false },
    dialogOnly: { type: Boolean, default: false }
  },
  emits: ['changed'],
  data () {
    return {
      collections: [],
      loading: false,
      creating: false,
      saving: false,
      showCollectionDialog: false,
      selectedCollectionId: null,
      newCollectionName: ''
    }
  },
  methods: {
    errorMessage (error, fallback) {
      return error.response && error.response.data && error.response.data.error ? error.response.data.error : fallback
    },
    async loadCollections () {
      this.loading = true
      try {
        const response = await this.$axios.get('/api/library/collections')
        this.collections = response.data.collections || []
        if (!this.selectedCollectionId && this.collections.length === 1) {
          this.selectedCollectionId = this.collections[0].id
        }
      } catch (error) {
        this.showErrNotif(this.errorMessage(error, t('libraryActions.loadFailed')))
      } finally {
        this.loading = false
      }
    },
    openCollectionDialog () {
      this.showCollectionDialog = true
      this.loadCollections()
    },
    async toggleArchive () {
      try {
        if (this.archived) await this.$axios.delete(`/api/library/works/${this.workId}/archive`)
        else await this.$axios.put(`/api/library/works/${this.workId}/archive`)
        this.showSuccNotif(this.archived ? t('libraryActions.unarchived') : t('libraryActions.archived'))
        this.$emit('changed', { type: 'archive', archived: !this.archived })
      } catch (error) {
        this.showErrNotif(this.errorMessage(error, t('libraryActions.archiveFailed')))
      }
    },
    async createCollection () {
      if (!this.newCollectionName || this.creating) return
      this.creating = true
      try {
        const response = await this.$axios.post('/api/library/collections', { name: this.newCollectionName })
        await this.loadCollections()
        this.selectedCollectionId = response.data.id
        this.newCollectionName = ''
      } catch (error) {
        this.showErrNotif(this.errorMessage(error, t('libraryActions.createFailed')))
      } finally {
        this.creating = false
      }
    },
    async addToCollection () {
      if (!this.selectedCollectionId) return
      this.saving = true
      try {
        const response = await this.$axios.post(`/api/library/collections/${this.selectedCollectionId}/items`, { workIds: [this.workId] })
        this.showSuccNotif(response.data.message)
        this.showCollectionDialog = false
        this.$emit('changed', { type: 'collection' })
      } catch (error) {
        this.showErrNotif(this.errorMessage(error, t('libraryActions.addFailed')))
      } finally {
        this.saving = false
      }
    }
  }
}
</script>

<style scoped>
.library-actions {
  display: inline-flex;
}

.library-dialog {
  width: min(460px, calc(100vw - 28px));
  max-height: 84dvh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.library-dialog-body {
  min-height: 0;
  gap: 16px !important;
}

.library-loading {
  display: flex;
  justify-content: center;
  padding: 24px 0;
}

.library-collection-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 34vh;
  padding: 2px;
}

.library-collection-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid var(--kikoeru-border);
  border-radius: var(--kikoeru-radius-sm);
  background: var(--kikoeru-inset);
  color: var(--kikoeru-text);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: border-color .15s ease, background-color .15s ease;
}

.library-collection-item:hover,
.library-collection-item:focus-visible {
  border-color: rgba(var(--kikoeru-accent-rgb), 0.45);
  background: rgba(var(--kikoeru-accent-rgb), 0.08);
  outline: none;
}

.library-collection-item--selected {
  border-color: rgba(var(--kikoeru-accent-rgb), 0.55);
  background: var(--kikoeru-active-bg);
}

.library-collection-item-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--kikoeru-muted);
  flex-shrink: 0;
}

.library-collection-item--selected .library-collection-item-icon,
.library-collection-item-check {
  color: var(--kikoeru-accent-text);
}

.library-collection-item-name {
  min-width: 0;
  flex: 1 1 auto;
  font-size: 14px;
  font-weight: 500;
  overflow-wrap: anywhere;
}

.library-collection-item-count {
  padding: 1px 7px;
  border-radius: 999px;
  background: var(--kikoeru-surface);
  border: 1px solid var(--kikoeru-border);
  color: var(--kikoeru-muted);
  font-size: 11.5px;
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}

.library-empty {
  padding: 20px 12px;
  border: 1px dashed var(--kikoeru-border);
  border-radius: var(--kikoeru-radius-sm);
}

.library-create-section {
  padding-top: 14px;
  border-top: 1px solid var(--kikoeru-border);
}

.library-create-row {
  display: flex;
  align-items: stretch;
  gap: 8px;
}

.library-create-input {
  flex: 1 1 auto;
  min-width: 0;
}

.library-create-btn {
  min-height: 40px;
  padding: 0 14px;
  border-radius: var(--kikoeru-radius-sm);
  flex-shrink: 0;
}
</style>
