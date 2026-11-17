<template>
  <q-page class="list-page">
    <header class="list-heading">
      <q-icon :name="headingIcon" size="26px" />
      <h1>{{ $t(`list.${restrict}.title`) }}</h1>
      <span class="list-count">{{ items.length }}</span>
    </header>

    <div class="list-search">
      <q-input dense outlined v-model="keyword" :placeholder="$t(`list.${restrict}.search`)" class="list-search-input">
        <template v-slot:prepend>
          <q-icon name="search" size="20px" />
        </template>
        <template v-slot:append>
          <q-icon v-if="keyword !== ''" name="close" class="cursor-pointer" @click="keyword = ''" />
        </template>
      </q-input>
    </div>

    <div v-if="visibleItems.length" class="list-grid">
      <router-link
        v-for="item in visibleItems"
        :key="item.id"
        :to="`/works?${queryField}=${item.id}`"
        class="list-chip"
      >
        <span class="list-chip__name">{{ item.name }}</span>
        <span class="list-chip__count">{{ item.count }}</span>
      </router-link>
    </div>
    <div v-else class="list-empty">
      <q-icon :name="keyword ? 'search_off' : headingIcon" size="34px" />
      <span>{{ keyword ? $t('works.noResults') : $t('works.emptyLibrary') }}</span>
    </div>
  </q-page>
</template>

<script>
import NotifyMixin from '../mixins/Notification.js'

export default {
  name: 'List',

  mixins: [NotifyMixin],

  props: {
    restrict: {
      type: String
    }
  },

  data () {
    return {
      items: [],
      keyword: ''
    }
  },

  created () {
    this.requestList()
  },

  computed: {
    url () {
      return `/api/${this.restrict}/`
    },

    headingIcon () {
      switch (this.restrict) {
        case 'circles':
          return 'group'
        case 'tags':
          return 'label'
        case 'vas':
          return 'mic'
        default:
          return 'group'
      }
    },

    queryField () {
      switch (this.restrict) {
        case 'circles':
          return 'circleId'
        case 'tags':
          return 'tagId'
        case 'vas':
          return 'vaId'
        default:
          return 'circleId'
      }
    },

    filteredItems () {
      return this.items.filter(item => item.name.toLowerCase().indexOf(this.keyword.toLowerCase()) !== -1)
    },

    visibleItems () {
      return this.keyword ? this.filteredItems : this.items
    }
  },

  watch: {
    url () {
      this.keyword = ''
      this.requestList()
    }
  },

  methods: {
    requestList () { 
      this.$axios.get(this.url)
        .then((response) => {
          this.items = response.data.concat()
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
  }
}
</script>

<style scoped>
.list-page {
  max-width: 1160px;
  margin: 0 auto;
  padding: 28px 24px 96px;
}

.list-heading {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 20px;
}

.list-heading > .q-icon {
  color: var(--kikoeru-accent-text);
}

.list-heading h1 {
  margin: 0;
  font-size: 26px;
  font-weight: 500;
  line-height: 36px;
  letter-spacing: 0;
}

.list-count {
  padding: 2px 8px;
  border-radius: 5px;
  background: var(--kikoeru-inset);
  color: var(--kikoeru-muted);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}

.list-search {
  margin-bottom: 20px;
}

.list-search-input {
  max-width: 440px;
}

.list-search-input :deep(.q-field__control) {
  border-radius: var(--kikoeru-radius-sm);
  background: var(--kikoeru-surface);
}

.list-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.list-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  max-width: 100%;
  min-height: 38px;
  padding: 6px 10px 6px 14px;
  border: 1px solid var(--kikoeru-border);
  border-radius: var(--kikoeru-radius-sm);
  background: var(--kikoeru-surface);
  color: var(--kikoeru-text);
  font-size: 14px;
  line-height: 1.4;
  transition: border-color .15s ease, background-color .15s ease, color .15s ease;
}

.list-chip:hover {
  border-color: var(--kikoeru-accent-text);
  background: var(--kikoeru-active-bg);
  color: var(--kikoeru-accent-text);
}

.list-chip:focus-visible {
  outline: 2px solid var(--kikoeru-accent-text);
  outline-offset: 2px;
}

.list-chip__name {
  min-width: 0;
  overflow-wrap: anywhere;
}

.list-chip__count {
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--kikoeru-inset);
  color: var(--kikoeru-muted);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.list-chip:hover .list-chip__count {
  color: inherit;
}

.list-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  min-height: 240px;
  border: 1px solid var(--kikoeru-border);
  border-radius: var(--kikoeru-radius-md);
  background: var(--kikoeru-surface);
  color: var(--kikoeru-muted);
}

@media (max-width: 699px) {
  .list-page {
    padding: 20px 12px 96px;
  }

  .list-heading h1 {
    font-size: 22px;
  }

  .list-search-input {
    max-width: none;
  }
}
</style>
