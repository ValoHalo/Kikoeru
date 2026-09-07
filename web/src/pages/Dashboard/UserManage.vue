<template>
  <q-page class="admin-page admin-management-page">
    <header class="settings-heading">
      <h1>用户管理</h1>
    </header>

    <section class="settings-section" aria-labelledby="admin-password-title">
      <div class="settings-section__heading">
        <q-icon name="vpn_key" size="22px" />
        <div>
          <h2 id="admin-password-title">修改管理员密码</h2>
          <div class="text-caption text-grey-7">新密码至少 5 个字符。</div>
        </div>
      </div>
      <q-form class="user-management-form" @submit="updateAdminPassword()">
        <q-input outlined dense hide-bottom-space type="password" label="新密码" aria-label="新密码"
          v-model="adminNewPassword"
          lazy-rules
          :rules="[ val => val.length >= 5 || '密码长度至少为 5' ]"
        />
        <q-input outlined dense hide-bottom-space type="password" label="确认密码" aria-label="确认密码"
          v-model="adminConfirmPassword"
          lazy-rules
          :rules="[
            val => val.length >= 5 || '密码长度至少为 5',
            val => val === adminNewPassword || '两次密码输入不一致'
          ]"
        />
        <q-btn class="settings-action-button" outline no-caps :loading="loadingUpdateAdminPassword" type="submit" color="primary" icon="vpn_key" label="修改密码" />
      </q-form>
    </section>

    <section class="settings-section" aria-labelledby="add-user-title">
      <div class="settings-section__heading">
        <q-icon name="person_add" size="22px" />
        <div>
          <h2 id="add-user-title">添加新用户</h2>
          <div class="text-caption text-grey-7">用户名和密码均至少 5 个字符，用户名不可重复。</div>
        </div>
      </div>
      <q-form class="user-management-form user-management-form--add" @submit="addNewUser()">
        <q-input outlined dense hide-bottom-space
          v-model="newuser.name" label="用户名" aria-label="用户名"
          required lazy-rules
          :rules="[
            val => val.length >= 5 || '用户名长度至少为 5',
            val => !users.find(user => user.name === val) || '该名称已存在，用户名不能重复',
          ]"
        />
        <q-input outlined dense hide-bottom-space label="密码" aria-label="密码"
          v-model="newuser.password"
          lazy-rules
          :rules="[ val => val.length >= 5 || '密码长度至少为 5' ]"
        />
        <q-select dense outlined hide-bottom-space options-dense label="用户组" aria-label="用户组" v-model="newuser.group" :options="groups" />
        <q-btn class="settings-action-button" unelevated no-caps :loading="loadingAddNewUser" type="submit" color="primary" icon="person_add" label="添加用户" />
      </q-form>
    </section>

    <section class="settings-section" aria-labelledby="users-title">
      <div class="settings-section__heading">
        <q-icon name="group" size="22px" />
        <h2 id="users-title">所有用户</h2>
      </div>
      <q-table
        flat bordered
        class="settings-table"
        :rows="users"
        :columns="columns"
        row-key="name"
        :selected-rows-label="getSelectedString"
        selection="multiple"
        v-model:selected="selected"
      />
      <div class="settings-form-actions">
        <q-btn outline no-caps :loading="loadingDeleteUsers" :disable="selected.length === 0" @click="confirm = true" color="negative" icon="delete_outline" label="删除所选用户" />
      </div>
    </section>

    <q-dialog v-model="confirm" persistent>
      <q-card>
        <q-card-section class="row items-center">
          <span class="q-ma-sm text-h6">确认删除选中用户？</span>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="取消" color="primary" v-close-popup />
          <q-btn flat label="确认" color="primary" @click="deleteUsers()" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script>
import NotifyMixin from '../../mixins/Notification.js'

export default {
  mixins: [NotifyMixin],

  data () {
    return {
      selected: [],
      columns: [
        { name: 'desc', required: true, label: '用户名', align: 'left', field: 'name', sortable: true },
        { name: 'calories', required: true, label: '用户组', align: 'center', field: 'group', sortable: true },
      ],
      users: [],
      loadingDeleteUsers: false,

      newuser: {
        name: '',
        password: '',
        group: 'user'
      },
      groups: ['user', 'guest'],
      loadingAddNewUser: false,

      
      adminNewPassword: '',
      adminConfirmPassword: '',
      loadingUpdateAdminPassword: false,

      confirm: false
    }
  },

  methods: {
    getSelectedString () {
      return this.selected.length === 0 ? '' : `${this.selected.length} record${this.selected.length > 1 ? 's' : ''} selected of ${this.users.length}`
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
      this.loadingDeleteUsers = true
      this.$axios.delete('/api/credentials/user', {
        data: { users: this.selected },
      })
        .then((response) => {
          this.selected.forEach(selectedUser => {
            const index = this.users.findIndex(user => user.name === selectedUser.name)
            this.users.splice(index, 1)
          })
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
