<template>
  <q-page class="admin-page admin-management-page">
    <header class="settings-heading">
      <h1>{{ $t('userManage.title') }}</h1>
    </header>

    <section class="settings-section" aria-labelledby="admin-password-title">
      <div class="settings-section__heading">
        <q-icon name="vpn_key" size="22px" />
        <div>
          <h2 id="admin-password-title">{{ $t('userManage.changeAdminPassword') }}</h2>
          <div class="text-caption text-grey-7">{{ $t('userManage.passwordHint') }}</div>
        </div>
      </div>
      <q-form class="user-management-form" @submit="updateAdminPassword()">
        <q-input outlined dense hide-bottom-space type="password" :label="$t('userManage.newPassword')" :aria-label="$t('userManage.newPassword')"
          v-model="adminNewPassword"
          lazy-rules
          :rules="[ val => val.length >= 5 || $t('userManage.passwordLength') ]"
        />
        <q-input outlined dense hide-bottom-space type="password" :label="$t('userManage.confirmPassword')" :aria-label="$t('userManage.confirmPassword')"
          v-model="adminConfirmPassword"
          lazy-rules
          :rules="[
            val => val.length >= 5 || $t('userManage.passwordLength'),
            val => val === adminNewPassword || $t('userManage.passwordMismatch')
          ]"
        />
        <q-btn class="settings-action-button" outline no-caps :loading="loadingUpdateAdminPassword" type="submit" color="primary" icon="vpn_key" :label="$t('userManage.changePassword')" />
      </q-form>
    </section>

    <section class="settings-section" aria-labelledby="add-user-title">
      <div class="settings-section__heading">
        <q-icon name="person_add" size="22px" />
        <div>
          <h2 id="add-user-title">{{ $t('userManage.newUser') }}</h2>
          <div class="text-caption text-grey-7">{{ $t('userManage.newUserHint') }}</div>
        </div>
      </div>
      <q-form class="user-management-form user-management-form--add" @submit="addNewUser()">
        <q-input outlined dense hide-bottom-space
          v-model="newuser.name" :label="$t('common.username')" :aria-label="$t('common.username')"
          required lazy-rules
          :rules="[
            val => val.length >= 5 || $t('userManage.usernameLength'),
            val => !users.find(user => user.name === val) || $t('userManage.duplicateUsername'),
          ]"
        />
        <q-input outlined dense hide-bottom-space :label="$t('common.password')" :aria-label="$t('common.password')"
          v-model="newuser.password"
          lazy-rules
          :rules="[ val => val.length >= 5 || $t('userManage.passwordLength') ]"
        />
        <q-select dense outlined hide-bottom-space options-dense emit-value map-options :label="$t('userManage.group')" :aria-label="$t('userManage.group')" v-model="newuser.group" :options="groups" />
        <q-btn class="settings-action-button" unelevated no-caps :loading="loadingAddNewUser" type="submit" color="primary" icon="person_add" :label="$t('userManage.addUser')" />
      </q-form>
    </section>

    <section class="settings-section" aria-labelledby="users-title">
      <div class="settings-section__heading">
        <q-icon name="group" size="22px" />
        <h2 id="users-title">{{ $t('userManage.allUsers') }}</h2>
      </div>
      <q-table
        ref="usersTable"
        flat bordered
        class="settings-table"
        :rows="users"
        :columns="columns"
        row-key="name"
        :selected-rows-label="getSelectedString"
        selection="multiple"
        :selected="selected"
        @update:selected="updateSelectedUsers"
      >
        <template #header-selection>
          <q-checkbox
            :model-value="pageSelection"
            :disable="pageDeletableUsers.length === 0 || loadingDeleteUsers"
            :aria-label="$t('userManage.selectPageUsers')"
            @update:model-value="selectPageUsers"
          />
        </template>
        <template #body-selection="scope">
          <q-checkbox
            :model-value="isDeletableUser(scope.row) && scope.selected"
            :disable="!isDeletableUser(scope.row) || loadingDeleteUsers"
            :aria-label="isDeletableUser(scope.row) ? $t('userManage.selectUser', { name: scope.row.name }) : $t('userManage.adminProtected')"
            @update:model-value="scope.selected = $event"
          >
            <q-tooltip v-if="!isDeletableUser(scope.row)">{{ $t('userManage.adminProtected') }}</q-tooltip>
          </q-checkbox>
        </template>
      </q-table>
      <div class="settings-form-actions">
        <q-btn outline no-caps :loading="loadingDeleteUsers" :disable="selected.length === 0 || loadingDeleteUsers" @click="confirm = true" color="negative" icon="delete_outline" :label="$t('userManage.deleteSelected')" />
      </div>
    </section>

    <q-dialog v-model="confirm" persistent>
      <q-card>
        <q-card-section class="row items-center">
          <span class="q-ma-sm text-h6">{{ $t('userManage.deletePrompt') }}</span>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat :label="$t('common.cancel')" color="primary" v-close-popup />
          <q-btn flat :label="$t('common.confirm')" color="primary" @click="deleteUsers()" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script>
import { ref } from 'vue'
import { t } from '../../i18n'
import NotifyMixin from '../../mixins/Notification.js'

export default {
  mixins: [NotifyMixin],

  setup () {
    return { usersTable: ref(null) }
  },

  computed: {
    pageDeletableUsers () {
      return (this.usersTable?.computedRows || []).filter(this.isDeletableUser)
    },
    pageSelection () {
      const selectedNames = new Set(this.selected.map(user => user.name))
      const selectedCount = this.pageDeletableUsers.filter(user => selectedNames.has(user.name)).length
      if (selectedCount === 0) return false
      return selectedCount === this.pageDeletableUsers.length ? true : null
    },
    groups () { return ['user', 'guest'].map(value => ({ value, label: this.groupLabel(value) })) },
    columns () {
      return [
        { name: 'desc', required: true, label: t('common.username'), align: 'left', field: 'name', sortable: true },
        { name: 'calories', required: true, label: t('userManage.group'), align: 'center', field: 'group', format: value => this.groupLabel(value), sortable: true },
      ]
    },
  },
  data () {
    return {
      selected: [],
      users: [],
      loadingDeleteUsers: false,

      newuser: {
        name: '',
        password: '',
        group: 'user'
      },
      loadingAddNewUser: false,

      adminNewPassword: '',
      adminConfirmPassword: '',
      loadingUpdateAdminPassword: false,

      confirm: false
    }
  },

  methods: {
    isDeletableUser (user) {
      return user.name !== 'admin'
    },
    updateSelectedUsers (users) {
      this.selected = users.filter(this.isDeletableUser)
    },
    selectPageUsers (value) {
      const pageNames = new Set(this.pageDeletableUsers.map(user => user.name))
      const otherSelected = this.selected.filter(user => !pageNames.has(user.name))
      this.updateSelectedUsers(value ? [...otherSelected, ...this.pageDeletableUsers] : otherSelected)
    },
    groupLabel (value) {
      return { user: t('userManage.user'), guest: t('userManage.guest'), administrator: t('userManage.administrator') }[value] || value
    },
    getSelectedString () {
      return this.selected.length === 0 ? '' : t('userManage.selectedCount', { count: this.selected.length, total: this.users.length })
    },

    addNewUser () {
      this.loadingAddNewUser = true
      this.$axios.post('/api/credentials/user', {
        name: this.newuser.name,
        password: this.newuser.password,
        group: this.newuser.group
      })
        .then((response) => {
          this.users.push(this.newuser)
          this.loadingAddNewUser = false
          this.showSuccNotif(response.data.message)
          this.requestUsers()
        })
        .catch((error) => {
          this.loadingAddNewUser = false
          // 请求已发出，但服务器响应的状态码不在 2xx 范围内
          if (error.response.status === 422) {
            this.showErrNotif(error.response.data.errors[0].msg)
          } else if (error.response.status === 403) {
            this.showWarnNotif(error.response.data.error)
          } else {
            this.showErrNotif(error.response.data.error || `${error.response.status} ${error.response.statusText}`)
          }
        })

    },

    deleteUsers () {
      if (this.loadingDeleteUsers) return
      const users = this.selected.filter(this.isDeletableUser).map(user => ({ name: user.name }))
      if (users.length === 0) return
      this.loadingDeleteUsers = true
      this.$axios.delete('/api/credentials/user', {
        data: { users },
      })
        .then((response) => {
          const deletedNames = new Set(users.map(user => user.name))
          this.users = this.users.filter(user => !deletedNames.has(user.name))
          this.selected = this.selected.filter(user => !deletedNames.has(user.name))
          this.loadingDeleteUsers = false
          this.showSuccNotif(response.data.message)
          this.requestUsers()
        })
        .catch((error) => {
          this.loadingDeleteUsers = false
          if (error.response) {
            // 请求已发出，但服务器响应的状态码不在 2xx 范围内
            if (error.response.status === 403) {
              this.showWarnNotif(error.response.data.error)
            } else {
              this.showErrNotif(error.response.data.error || `${error.response.status} ${error.response.statusText}`)
            }
          } else {
            this.showErrNotif(error.message || error)
          }
        })
    },

    updateAdminPassword () {
      this.loadingUpdateAdminPassword = true
      this.$axios.put('/api/credentials/user', {
        name: 'admin',
        newPassword: this.adminNewPassword
      })
        .then(async (response) => {
          this.loadingUpdateAdminPassword = false
          this.showSuccNotif(response.data.message)

          // 仅当启用鉴权时跳转到登录页面
          if (this.$store.state.User.auth) {
            await this.$axios.post('/api/auth/logout')
            this.$store.commit('User/CLEAR')
            this.$router.push('/login')
          }
        })
        .catch((error) => {
          this.loadingUpdateAdminPassword = false
          if (error.response) {
            // 请求已发出，但服务器响应的状态码不在 2xx 范围内
            this.showErrNotif(error.response.data.error || `${error.response.status} ${error.response.statusText}`)
          } else {
            this.showErrNotif(error.message || error)
          }
        })
    },

    requestUsers () {
      this.$axios.get('/api/credentials/users')
        .then((response) => {
          this.users = response.data.users
          const selectedNames = new Set(this.selected.map(user => user.name))
          this.updateSelectedUsers(this.users.filter(user => selectedNames.has(user.name)))
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
  },

  created () {
    this.requestUsers()
  }
}
</script>
