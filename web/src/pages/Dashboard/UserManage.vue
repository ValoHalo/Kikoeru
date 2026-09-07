<template>
  <q-page class="admin-page admin-management-page">
    <header class="settings-heading">
      <div class="text-h5">用户管理</div>
    </header>

    <section class="settings-section" aria-labelledby="admin-password-title">
      <div class="settings-section__heading">
        <q-icon name="vpn_key" size="22px" />
        <div id="admin-password-title" class="text-subtitle1 text-weight-medium">修改管理员密码</div>
      </div>
      <q-form @submit="updateAdminPassword()">
        <q-list bordered separator class="settings-list">
          <q-item class="settings-row">
            <q-item-section><q-item-label>新密码</q-item-label></q-item-section>
            <q-item-section side class="settings-control settings-control--input">
              <q-input outlined dense hide-bottom-space type="password" aria-label="新密码"
                v-model="adminNewPassword"
                lazy-rules
                :rules="[ val => val.length >= 5 || '密码长度至少为 5' ]"
              />
            </q-item-section>
          </q-item>
          <q-item class="settings-row">
            <q-item-section><q-item-label>确认密码</q-item-label></q-item-section>
            <q-item-section side class="settings-control settings-control--input">
              <q-input outlined dense hide-bottom-space type="password" aria-label="确认密码"
                v-model="adminConfirmPassword"
                lazy-rules
                :rules="[
                  val => val.length >= 5 || '密码长度至少为 5',
                  val => val === adminNewPassword || '两次密码输入不一致'
                ]"
              />
            </q-item-section>
          </q-item>
        </q-list>
        <div class="settings-form-actions">
          <q-btn outline no-caps :loading="loadingUpdateAdminPassword" type="submit" color="primary" icon="vpn_key" label="修改密码" />
        </div>
      </q-form>
    </section>

    <section class="settings-section" aria-labelledby="add-user-title">
      <div class="settings-section__heading">
        <q-icon name="person_add" size="22px" />
        <div id="add-user-title" class="text-subtitle1 text-weight-medium">添加新用户</div>
      </div>
      <q-form @submit="addNewUser()">
        <q-list bordered separator class="settings-list">
          <q-item class="settings-row">
            <q-item-section><q-item-label>用户组</q-item-label></q-item-section>
            <q-item-section side class="settings-control settings-control--input">
              <q-select dense outlined hide-bottom-space options-dense aria-label="用户组" v-model="newuser.group" :options="groups" />
            </q-item-section>
          </q-item>
          <q-item class="settings-row">
            <q-item-section><q-item-label>用户名</q-item-label></q-item-section>
            <q-item-section side class="settings-control settings-control--input">
              <q-input outlined dense hide-bottom-space
                v-model="newuser.name" aria-label="用户名"
                required lazy-rules
                :rules="[
                val => val.length >= 5 || '用户名长度至少为 5',
                val => !users.find(user => user.name === val) || '该名称已存在，用户名不能重复',
                ]"
              />
            </q-item-section>
          </q-item>
          <q-item class="settings-row">
            <q-item-section><q-item-label>密码</q-item-label></q-item-section>
            <q-item-section side class="settings-control settings-control--input">
              <q-input outlined dense hide-bottom-space aria-label="密码"
                v-model="newuser.password"
                lazy-rules
                :rules="[ val => val.length >= 5 || '密码长度至少为 5' ]"
              />
            </q-item-section>
          </q-item>
        </q-list>
        <div class="settings-form-actions">
          <q-btn unelevated no-caps :loading="loadingAddNewUser" type="submit" color="primary" icon="person_add" label="添加用户" />
        </div>
      </q-form>
    </section>

    <section class="settings-section" aria-labelledby="users-title">
      <div class="settings-section__heading">
        <q-icon name="group" size="22px" />
        <div id="users-title" class="text-subtitle1 text-weight-medium">所有用户</div>
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
