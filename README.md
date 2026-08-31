# Kikoeru

Kikoeru 是用于管理和播放本地 DLsite 音声作品的自托管媒体应用。

## 主要功能

- 扫描本地 RJ、BJ、VJ 和 CC 作品目录，获取作品元数据与封面。
- 直接播放原始音频，或按需生成 AAC 128k、AAC 320k 转码，不修改媒体目录中的原始文件。
- 管理当前播放队列和已保存的播放列表，并恢复上次队列、曲目顺序、播放位置、播放模式与播放速度。
- 为每位用户分别保存播放进度、收藏、评价、作品分组和归档状态。
- 支持直连、服务器环境变量和手动 HTTP 代理，并可测试 DLsite、图片 CDN、Kikoeru 元数据服务和 GitHub Releases 的连通性。
- 提供 Windows、Linux x64 便携包和 Docker/Podman 镜像；便携版可以在管理页面检查、下载并安装更新。

## Windows 快速开始

1. 从 [GitHub Releases](https://github.com/ValoHalo/Kikoeru/releases) 下载最新的 `kikoeru-win-x64-<commit ID>.zip`。
2. 解压 ZIP，运行 `start-kikoeru.cmd`。
3. 本机打开 `http://127.0.0.1:8888/`；远程设备打开 `http://<服务器 IP>:8888/`。
4. 使用默认用户名 `admin`、默认密码 `admin` 登录。
5. 首次进入管理设置时，依次添加媒体目录、选择联网方式、测试服务器联网并选择默认播放方式；保存后进入扫描页面。

## 如何添加音声库

先把拥有的音声作品解压到一个固定的媒体目录。每个作品使用一个独立文件夹，文件夹名中应包含该作品的 DLsite 作品编号。

例如，可以按下面的方式整理，目录内部的文件名无关紧要：

```text
E:\media\
├─ RJ01610397\
├─ RJ01355336 作品标题\
└─ XX社团\
   └─ RJ01355336\
```

作品文件夹请遵循以下规则：

- 推荐直接使用 DLsite 上的完整作品编号，例如 `RJ01469493`，并保留编号中的前导零。扫描器也支持以 `BJ`、`VJ` 和 `CC` 开头的作品编号。
- 编号前缀和数字之间不能有空格。`RJ01469493` 可以识别，`RJ 01469493` 和只有数字的 `01469493` 不能识别。
- 文件夹名可以在编号后附加作品标题，例如 `RJ01469493 作品标题`；为减少识别错误，建议把编号放在最前面并使用大写字母。
- 一个作品文件夹只放一个作品。压缩包需要先解压，音频文件可以直接放在作品文件夹中，也可以继续按章节建立子文件夹。
- 默认可以扫描媒体根目录中的作品文件夹，也可以扫描一层分类目录下的作品文件夹。目录更深时，需要在“高级设置”中提高“最大递归扫描深度”。

首次使用时，按以下步骤导入：

1. 使用管理员账号登录，进入自动打开的“首次初始化”页面。
2. 填写一个便于区分的目录名称和服务器能够访问的绝对路径。例如，Windows 可以填写 `E:\media`，Linux 可以填写 `/mnt/media`；使用 Docker 或 Podman 时应填写容器内路径 `/media`。
3. 选择直连、环境变量或手动代理。手动代理的主机留空时使用 `127.0.0.1`，代理端口需要手动填写。
4. 测试服务器联网，选择原始音频或 AAC 转码，然后保存并前往扫描页面。
5. 点击“扫描本地音声库”。扫描完成后返回媒体库查看作品。

以后增加媒体目录时，进入“管理设置 / 音声库”添加目录，再到“管理设置 / 扫描”重新扫描。向已有目录加入新作品后也只需重新扫描，不需要再次完成初始化。

音频文件可以放在作品文件夹内的任意子目录中，常见的 `mp3`、`flac`、`wav`、`m4a`、`aac`、`opus` 和 `ogg` 格式均可识别。

## Linux 与容器运行

Linux x64 用户可以从 [GitHub Releases](https://github.com/ValoHalo/Kikoeru/releases) 下载 `kikoeru-linux-x64-<commit ID>.tar.gz`。解压后运行 `start-kikoeru.sh`，用户数据默认保存在同目录的 `data/`。

正式版本容器镜像发布在 `ghcr.io/valohalo/kikoeru`。Podman 示例：

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

## 更新

Windows 和 Linux 便携版可以在“管理设置 / 更新”中检查并下载 GitHub Release。下载完成后由管理员确认安装，服务会重启并保留 `data/` 中的配置、数据库、封面和转码文件。自动下载默认关闭。

检查 GitHub Release 和下载更新包时，会使用“高级设置”中选择的联网方式。使用手动代理时需要填写代理主机和端口；使用环境变量时，服务器进程会读取 `HTTP_PROXY`、`HTTPS_PROXY` 和 `NO_PROXY`。

源码运行模式只提供版本提示。Docker 和 Podman 版本通过容器镜像更新；镜像版本标签与 GitHub Release 标签一致，同时提供 `latest` 标签。

## 目录结构

```text
server/                       Express 后端源码、测试和打包器
web/                          Vue 3 / Quasar 2 前端源码
build-windows-release.ps1     Windows 一键构建入口
build-linux-release.sh        Linux x64 一键构建入口
.github/workflows/            GitHub Actions 构建配置
```

构建生成或下载的工具链、依赖、FFmpeg 和中间文件统一放在仓库根目录的 `.build/`。最终便携包生成到仓库根目录，以 commit ID 区分不同提交的构建。

## 从源码构建

在 Windows PowerShell 中构建 Windows x64 便携包：

```powershell
.\build-windows-release.ps1
```

在 Linux x64 上构建便携包：

```bash
./build-linux-release.sh
```

首次构建会准备所需工具链和固定的 FFmpeg LGPL 构建，安装锁定依赖、运行检查并生成发行包。完整环境要求、构建过程和 GitHub Actions 行为见 [BUILDING.md](BUILDING.md)。

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

程序作者并不能防止内容提供商（如各类网站）或其它用户使用本程序提供侵权或其它非法内容。程序作者与使用本程序的各类内容提供商并无联系，不为其提供技术支持，也不为其不当使用承担法律责任。

## 许可协议

GNU General Public License v3.0
