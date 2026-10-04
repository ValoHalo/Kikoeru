# 构建与开发

本文介绍 Kikoeru 的源码结构、本地开发和发行包构建，下载与日常使用请查看 [README](README.md)

## 仓库目录

```text
server/                       Express 后端源码、测试和打包器
web/                          Vue 3 / Quasar 2 前端源码
build-windows-release.ps1     Windows 一键构建入口
build-linux-release.sh        Linux x64 一键构建入口
.github/workflows/            GitHub Actions 构建配置
```

构建中间文件集中保存在仓库根目录的 `.build/`，便携包输出到仓库根目录，文件名使用提交编号区分不同版本的源码

## 本地开发

建议使用 Node.js 24 和 npm 11，与前端的环境要求保持一致，并为后端准备可从命令行调用的 `ffmpeg` 与 `ffprobe`

后端 `package.json` 的 Node.js 声明仍为 `>=18`，但当前 `better-sqlite3` 依赖已不支持 Node.js 18，准备开发环境时应同时满足依赖要求

在 `server` 目录安装依赖并运行检查

```powershell
Set-Location server
npm ci
npm test
npm run check
```

启动后端

```powershell
npm run dev
```

另开一个终端，在 `web` 目录安装依赖并运行检查

```powershell
Set-Location web
npm ci
npm run check
npm run lint
npm run build
```

需要热更新时，在 `web` 目录运行

```powershell
npx quasar dev
```

前端开发服务器默认将 API 请求转发到 `http://127.0.0.1:8888`，后端使用其他地址时，可以通过 `KIKOERU_DEV_API` 指定

如果只是构建便携包，直接使用下面对应平台的一键构建脚本即可，脚本会准备隔离的工具链与工作副本

## Windows x64 便携包

### 环境要求

- Windows 10/11 x64 或 Windows Server x64
- PowerShell 5.1 或更高版本
- Node.js 22 或更高的兼容版本和 npm，当前 Windows CI 使用 Node.js 22 与 npm 11
- 能够访问 Node.js、npm registry、GitHub 和 pkg 运行时下载地址的网络

无需预先安装前端使用的 Node.js 24 或 FFmpeg，脚本会将工具链、下载、npm 缓存、工作副本和检查结果保存在 `.build/` 中

### 一键构建

在仓库根目录运行

```powershell
.\build-windows-release.ps1
```

首次构建会下载并解压配置中指定的 Node.js 24 前端工具链与 FFmpeg LGPL 归档，校验 FFmpeg 的 SHA-256 后，安装锁定依赖并构建前端 PWA

脚本随后在 `.build/work/` 中准备后端工作副本，部署前端文件，运行后端测试和语法检查，再使用 Node.js 22 的 pkg target 生成便携程序

当前 Windows 前端工具链为 Node.js 24.14.1，版本和下载地址以 `server/scripts/release-config.json` 为准

输出文件位于仓库根目录

```text
kikoeru-win-x64-<6 位 commit ID>.zip
```

不同提交的 ZIP 使用不同文件名，同一提交重复构建仍会使用同一个文件名，未提交的改动会参与构建，但不会反映在文件名的提交编号中

ZIP 包含应用程序、`ffmpeg.exe`、`ffprobe.exe`、启动脚本和根目录下的 `LICENSE`，该许可证文件包含项目 GPLv3 全文与 FFmpeg 归档自带的 LGPLv3 全文

用户数据由首次启动创建在解压目录下的 `data/` 中，构建脚本在隔离工作副本中安装后端依赖，不会原地重装源码目录的依赖，因此不会因源码服务正在使用原生模块而要求先停止服务

### 手动准备 FFmpeg

自动下载失败时，可以手动准备归档

1. 打开 `server/scripts/release-config.json`，访问 `ffmpeg.archiveUrl` 指定的地址
2. 将下载文件命名为 `ffmpeg.archiveFileName` 指定的文件名，保留压缩包，不要解压
3. 将归档放到仓库根目录的 `.build/downloads/` 中
4. 重新运行 `build-windows-release.ps1`

最终路径为 `.build/downloads/<ffmpeg.archiveFileName>`

脚本发现归档后会跳过下载，但仍会校验 SHA-256，并检查归档中的 `ffmpeg.exe`、`ffprobe.exe` 和 `LICENSE.txt`，文件内容或结构不匹配时会停止构建

## Linux x64 便携包

### 环境要求

- Linux x64，glibc 2.28 或更高版本
- Bash、Git、curl、tar 和 SHA-256 工具
- Node.js 24，用于读取构建配置
- 能够访问 Node.js、npm registry 和 GitHub 的网络

### 一键构建

在仓库根目录运行

```bash
./build-linux-release.sh
```

脚本会在 `.build/` 中下载并校验固定版本的 Node.js Linux x64 运行时和 FFmpeg LGPL 归档，创建隔离的前后端工作副本，安装锁定依赖，运行后端测试与语法检查，再构建前端 PWA

实际构建和最终产物使用脚本下载的固定 Node.js 24 运行时，当前配置为 Node.js 24.19.0

输出文件位于仓库根目录

```text
kikoeru-linux-x64-<6 位 commit ID>.tar.gz
```

文件名中的提交编号取自当前 HEAD，产品版本读取自 `server/package.json`

便携包包含 Node.js 运行时、生产依赖、前端文件、FFmpeg、启动脚本和许可证，用户数据默认保存在解压目录下的 `data/`

## Podman / Docker 镜像

两个容器工具共用仓库根目录的 `Dockerfile`，在仓库根目录构建并运行

```bash
podman build -t kikoeru:local .
KIKOERU_PORT=8888
podman run --rm \
  -e PORT="$KIKOERU_PORT" \
  -p "$KIKOERU_PORT:$KIKOERU_PORT" \
  -v kikoeru-data:/data \
  -v /path/to/VoiceWork:/media \
  kikoeru:local
```

`KIKOERU_PORT` 可按需修改，使用 Docker 时将命令中的 `podman` 替换为 `docker`

镜像使用 Node.js 24，构建阶段生成 PWA 和 Linux 原生依赖，运行阶段提供 FFmpeg

配置与数据库保存在 `/data`，媒体目录挂载到 `/media`，首次启动后需要在管理设置中把音声库目录配置为 `/media`

## 构建配置与缓存

### 版本号

产品版本由 `server/package.json` 的 `version` 字段维护，后端运行配置、`/api/version`、测试运行配置和 Windows 打包均从这里读取版本

`server/package-lock.json` 中的同名字段由 npm 同步更新，前端随服务端发布，不单独维护产品版本

升版时在 `server` 目录运行 npm 的版本命令，例如

```powershell
Set-Location server
npm version 1.1.0 --no-git-tag-version
```

命令中的版本号应替换为准备发布的新版本，正式发布使用与产品版本一致的 Git tag，例如 `v1.1.0`，便携包文件名继续使用提交编号标识源码

### FFmpeg 来源

Windows 和 Linux 的 FFmpeg 归档来自 [Kikoeru-FFmpeg Releases](https://github.com/KaffuAlcaid/Kikoeru-FFmpeg/releases)，构建使用固定版本标签的下载地址并校验 SHA-256

下载地址、归档结构和校验值集中配置在 `server/scripts/release-config.json`，更新 FFmpeg 时修改该文件即可，无需向仓库提交二进制文件

Windows 使用直接包含二进制目录的 ZIP，Linux 使用 tar.xz，GitHub Actions 下载时生成的外层 ZIP 不能直接用于打包

`archiveFileName` 应包含 Release 版本，以区分不同版本中同名的归档，`archiveRoot` 必须与压缩包内的实际目录一致

### 文件与缓存位置

| 位置 | 内容 |
| --- | --- |
| `.build/tooling/` | 构建使用的 Node.js 等工具链 |
| `.build/cache/` | npm 等依赖缓存 |
| `.build/downloads/` | 下载的发行归档 |
| `.build/pkg-cache/` | pkg 运行时缓存 |
| `.build/native-cache/` | 原生模块构建缓存 |
| `.build/work/` | 带有依赖、前端产物和检查数据的隔离工作副本 |
| `.build/release/` | 当前构建使用的临时打包目录 |
| 仓库根目录 | 最终 Windows ZIP 和 Linux tar.gz |

构建脚本无需传入参数，首次运行需要联网，后续构建会复用工具链与缓存，并刷新工作副本和临时打包目录

通常不需要清理整个 `.build/`，只有工具损坏，或依赖与工具版本变化后出现异常时，再处理对应缓存目录

仓库保留源码、配置、锁定依赖文件、已有测试、构建脚本、`LICENSE` 和 `server/scripts/release-config.json`，工具链、依赖目录和构建产物由本地构建或 CI 生成

## GitHub Actions

`.github/workflows/build-windows.yml` 支持手动触发和推送 `v*` tag 触发，Windows x64 与 Linux x64 便携包会并行构建，Linux 任务还会构建容器镜像

两种触发方式都会上传便携包作为工作流产物，手动触发不会发布 GitHub Release

推送版本 tag 时，工作流先检查 tag 是否与 `server/package.json` 的产品版本一致，两个平台都构建成功后才会创建同名 GitHub Release，自动生成发布说明并上传两个便携包

容器镜像在 Linux 构建任务中发布到 GHCR，同时使用版本 tag 和 `latest` 标签，这一步发生在最终 GitHub Release 创建之前

Actions 不提交 `.build/`，仓库无需保存 FFmpeg、Node.js 工具链或编译后的前端文件
