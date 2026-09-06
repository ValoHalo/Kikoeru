# Kikoeru

Kikoeru 是用于管理和播放本地 DLsite 音声作品的自托管媒体应用。

## 主要功能

- 扫描本地 RJ、BJ、VJ 和 CC 开头的音声作品，并从 DLsite 获取作品对应的元数据与封面。
- 识别本地字幕的语言，并根据偏好设置自动选择。
- 便携版可以在 WebUI 中检查、下载并安装更新。

## 快速开始

1. 从 [GitHub Releases](https://github.com/ValoHalo/Kikoeru/releases) 下载适合自己系统版本的便携版 Kikoeru 压缩包。
2. 解压 ZIP，运行 `start-kikoeru.cmd` 或 `start-kikoeru.sh`。
3. 本机打开 `http://127.0.0.1:8888/`；远程设备打开 `http://<服务器 IP>:8888/`。
4. 使用默认用户名 `admin`、默认密码 `admin` 登录。
5. 根据`首次初始化`页面的指示进行初次配置。
6. 设置完毕后进入扫描页面，点击`扫描本地音声库`按钮即可开始首次数据库的建立。

## 关于音声库

建议选择一个固定的媒体目录来保存音声文件。每个音声作品占据单独的文件夹，文件夹名中应包含该作品的 DLsite 作品编号。

例如下面的整理方式都是合法的（目录内部的文件名和文件结构无关紧要）：

```text
E:\media\
├─ RJ01610397\
├─ RJ01355336 作品标题\
└─ XX社团\
   └─ RJ01355336\
```

音频文件可以放在作品文件夹内的任意子目录中，常见的 `mp3`、`flac`、`wav`、`m4a`、`aac`、`opus`、  `ogg` 格式均可识别。部分作品提供的 `mp4` 视频也可以在大图模式下播放画面。

## 更新

Windows 和 Linux 便携版可以在`管理设置 / 更新`中检查并下载最新的 GitHub Release。安装操作需要由管理员进行。

## 容器运行
容器镜像发布在 [ghcr.io](https://ghcr.io/valohalo/kikoeru)。Podman 示例：

```bash
KIKOERU_PORT=8888
podman run -d --name kikoeru \
  -e PORT="$KIKOERU_PORT" \
  -p "$KIKOERU_PORT:$KIKOERU_PORT" \
  -v kikoeru-data:/data \
  -v /path/to/VoiceWork:/media \
  ghcr.io/valohalo/kikoeru:latest
```

`KIKOERU_PORT` 可按需修改。使用 Docker 时将上述命令中的 `podman` 替换为 `docker`。首次登录后，在初始化页面中把媒体目录配置为容器内的 `/media`。

## 仓库目录结构

```text
server/                       Express 后端源码、测试和打包器
web/                          Vue 3 / Quasar 2 前端源码
build-windows-release.ps1     Windows 一键构建入口
build-linux-release.sh        Linux x64 一键构建入口
.github/workflows/            GitHub Actions 构建配置
```

构建的中间文件统一放在仓库根目录的 `.build/`。编译产物生成到仓库根目录，以 commit ID 区分不同提交的构建。

## 从源码构建

在 Windows PowerShell 中构建 Windows 便携包：

```powershell
.\build-windows-release.ps1
```

在 Linux 上构建便携包：

```bash
./build-linux-release.sh
```

首次构建会准备所需工具链和固定的 FFmpeg LGPL 构建，安装锁定依赖、运行检查并生成发行包。详情见 [BUILDING.md](BUILDING.md)。

如需自行构建容器镜像：

```bash
podman build -t kikoeru:local .
```

使用 Docker 时将 `podman` 替换为 `docker`。

## 本地开发

后端需要 Node.js 18 或更高版本：

```powershell
Set-Location server
npm ci
npm test
npm run check
```

前端需要 Node.js 24 和 npm 11：

```powershell
Set-Location web
npm ci
npm run check
npm run lint
npm run build
```

需要热更新开发服务器时，在 `web` 目录运行 `npx quasar dev`。如果只需要构建便携包，建议使用对应平台的一键构建脚本，由脚本准备隔离工具链。

## 致谢

* [kikoeru-express](https://github.com/Number178/kikoeru-express) 及其 [Docker 镜像](https://hub.docker.com/r/number17/kikoeru)

  上游后端，基于 Docker 镜像代码进行修改

* [kikoeru-quasar](https://github.com/Number178/kikoeru-quasar)

  上游前端，适配到新版本后端后进行改动

* ASMR ONE

  参考了一些交互和设置项

* ChatGPT/Codex

## 声明

本项目作为开源软件，本身不包含任何版权内容或其它违反法律的内容。项目中的程序是为了个人用户管理自己所有的合法数据资料而设计的。

程序作者并不能防止内容提供商或其它用户使用本程序提供侵权或其它非法内容。程序作者与使用本程序的各类内容提供商并无联系，不为其提供技术支持，也不为其不当使用承担法律责任。

## 许可协议

GNU General Public License v3.0
