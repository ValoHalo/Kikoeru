import MainLayout from 'layouts/MainLayout.vue'
import DashboardLayout from 'layouts/DashboardLayout.vue'

import Works from 'pages/Works.vue'
import Work from 'pages/Work.vue'
import List from 'pages/List.vue'
import Favourites from 'pages/Favourites.vue'
import FullScreenPlayer from 'pages/FullScreenPlayer.vue'
import Playlist from 'pages/Playlist.vue'
import Preferences from 'pages/Preferences.vue'
import About from 'pages/About.vue'

import Folders from 'pages/Dashboard/Folders.vue'
import Scanner from 'pages/Dashboard/Scanner.vue'
import Advanced from 'pages/Dashboard/Advanced.vue'
import DefaultPreferences from 'pages/Dashboard/DefaultPreferences.vue'
import UserManage from 'pages/Dashboard/UserManage.vue'
import Setup from 'pages/Dashboard/Setup.vue'
import Update from 'pages/Dashboard/Update.vue'

function prefixRoutes(prefix, routes) {
  return routes.map((route) => {
    route.path = prefix + '' + route.path;
    return route;
  });
}

const routes = [
  {
    path: '/admin',
    component: DashboardLayout,
    meta: {
      requiresAdministrator: true
    },
    children: [
      {
        path: '',
        component: Folders
      },
      {
        path: 'setup',
        component: Setup
      },
      {
        path: 'scanner',
        component: Scanner
      },
      {
        path: 'defaults',
        component: DefaultPreferences
      },
      {
        path: 'advanced',
        component: Advanced
      },
      {
        path: 'usermanage',
        component: UserManage
      },
      {
        path: 'update',
        component: Update
      }
    ]
  },
  {
    path: '/',
    component: MainLayout,
    children: [
      {
        path: '',
        redirect: {
          name: 'works'
        }
      },
      {
        path: 'works',
        name: 'works',
        component: Works
      },
      {
        path: 'work/:id',
        component: Work
      },
      {
        path: 'search',
        name: 'advance search', // 必要，Works页面根据这个name判断是否开启高级搜索功能
        component: Works,
      },
      {
        path: 'circles',
        props: { restrict: "circles" },
        component: List
      },
      {
        path: 'tags',
        props: { restrict: "tags" },
        component: List
      },
      {
        path: 'vas',
        props: { restrict: "vas" },
        component: List
      },
      {
        path: 'fullScreenPlayer/:id?',
        component: FullScreenPlayer
      },
      {
        path: 'playlist',
        component: Playlist
      },
      {
        path: 'preferences',
        component: Preferences
      },
      {
        path: 'about',
        component: About
      },
      ...prefixRoutes('favourites', [
        {
          path: '',
          props: { route: 'histroy'},
          component: Favourites,
        },
        {
          path: '/review',
          props: { route: 'review'},
          component: Favourites,
        },
        ...prefixRoutes('/progress', [
          {
            path: '',
            props: { route: 'progress', progress: 'marked'},
            component: Favourites,
          },
          {
            path: '/marked',
            props: { route: 'progress', progress: 'marked'},
            component: Favourites,
          },
          {
            path: '/listening',
            props: { route: 'progress', progress: 'listening'},
            component: Favourites,
          },
          {
            path: '/listened',
            props: { route: 'progress', progress: 'listened'},
            component: Favourites,
          },
          {
            path: '/replay',
            props: { route: 'progress', progress: 'replay'},
            component: Favourites,
          },
          {
            path: '/postponed',
            props: { route: 'progress', progress: 'postponed'},
            component: Favourites,
          },
        ]),
        {
          path: '/folder',
          props: { route: 'folder'},
          component: Favourites,
        },
        {
          path: '/archived',
          props: { route: 'archived'},
          component: Favourites,
        },
        {
          path: '/histroy',
          props: { route: 'histroy'},
          component: Favourites,
        },
      ]),
    ],
    meta: {
      auth: true
    }
  },
  {
    path: '/login',
    redirect: to => ({
      path: '/works',
      query: { ...to.query, login: '1' }
    })
  }
]

// Always leave this as last one
// eslint-disable-next-line
if (process.env.MODE !== 'ssr') {
  routes.push({
    path: '/:catchAll(.*)*',
    component: () => import('pages/Error404.vue')
  })
}

export default routes
