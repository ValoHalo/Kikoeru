# 构建指南

## Windows x64 便携包

### 版本号

产品版本只在 `server/package.json` 的 `version` 字段中维护。后端运行时配置、`/api/version`、测试运行配置和 Windows 打包都从这里读取版本；`server/package-lock.json` 中的同名字段由 npm 自动生成，不作为独立版本源。前端是随服务端发布的私有包，不维护独立版本。正式发布使用与产品版本一致的 Git tag，例如 `v0.7.0`；ZIP 文件名继续使用 commit ID 标识具体源码。

升版时从 `server` 目录运行 npm 的版本命令，让 npm 同时更新 `package.json` 和生成的 lockfile：

```powershell
Set-Location server
npm version 0.8.0 --no-git-tag-version
```

### 环境要求

- Windows 10/11 x64 或 Windows Server x64
- PowerShell 5.1 或更高版本
- Node.js 22 或更高版本和随附的 npm，用于后端测试与打包
- 可访问 Node.js、npm registry、GitHub 和 pkg 运行时下载地址的网络

无需预先安装前端使用的 Node.js 24 或 FFmpeg。构建脚本产生的工具链、下载、npm 缓存、工作副本、测试数据和结果全部位于仓库根目录的 `.build/`，不写入源码目录或用户级 npm 缓存。

### 一键构建

```powershell
git clone <repository-url> kikoeru
Set-Location kikoeru
.\build-windows-release.ps1
```

脚本会依次完成：

1. 下载并解压用于 Vue 3 / Quasar 2 前端构建的 Node.js 24.14.1。
2. 下载固定的 FFmpeg Windows x64 LGPL 归档并校验 SHA-256。
3. 按两个 lockfile 安装依赖。
4. 检查并构建 Quasar PWA。
5. 在 `.build/work/` 创建隔离的前后端构建副本并安装依赖。
6. 在隔离副本中部署 PWA、运行测试和语法检查。
7. 使用 Node.js 22 的 pkg target 构建便携程序并生成 ZIP。

#### 手动下载 FFmpeg

如果脚本无法自动下载 FFmpeg，可以使用浏览器手动准备归档：

1. 打开 `server/scripts/release-config.json`，访问 `ffmpeg.archiveUrl` 指定的下载地址。
2. 下载完成后，确保文件名与 `ffmpeg.archiveFileName` 完全一致，不要解压或改名。
3. 在仓库根目录创建 `.build/downloads/`，把归档放入该目录。最终路径应为 `.build/downloads/<ffmpeg.archiveFileName>`。
4. 重新运行 `.\build-windows-release.ps1`。

脚本发现该文件后会跳过 FFmpeg 下载，但仍会按照 `ffmpeg.archiveSha256` 校验文件，并检查归档中是否包含所需的 `ffmpeg.exe`、`ffprobe.exe` 和 `LICENSE.txt`。文件版本、名称或内容不匹配时，构建会停止并报告错误。

服务端依赖不会在源码目录原地重装，因此即使本地 Kikoeru 服务正在运行，构建也不会因原生模块被占用而要求先停服务。

输出文件直接位于仓库根目录：

```text
kikoeru-win-x64-<6 位 commit ID>.zip
```

不同提交的 ZIP 不会互相覆盖。同一提交重复构建仍对应同一个文件名；未提交改动会被编译进去，但不会反映在文件名的 commit ID 中。ZIP 包含应用程序、`ffmpeg.exe`、`ffprobe.exe`、启动脚本和根目录下唯一的 `LICENSE`；该文件依次包含项目 GPLv3 全文和 FFmpeg 归档自带的 LGPLv3 全文。用户数据由首次启动创建在 ZIP 解压目录下的 `data/` 中。

默认 FFmpeg 下载信息集中在 `server/scripts/release-config.json`。需要更新 FFmpeg 时，只修改该文件中的下载地址、归档结构和 SHA-256，不需要把二进制提交到 Git。

## 哪些文件进入仓库

仓库中准备好并提交：

- `server/src`、`web/src` 及其他源码和配置
- `server/package-lock.json`、`web/package-lock.json`
- 单元测试和构建脚本
- 根目录 `LICENSE`
- `server/scripts/release-config.json`

本地或 CI 自动生成：

- `.build/tooling/` 中的 Node.js 24.14.1 前端工具链
- `.build/cache/`、`.build/downloads/`、`.build/pkg-cache/` 和 `.build/native-cache/` 中的下载与编译缓存
- `.build/work/` 中带 `node_modules`、PWA 和测试数据的前后端隔离工作副本
- `.build/release/` 中仅供当前构建使用的临时 staging
- 仓库根目录中的 `kikoeru-win-x64-<commit ID>.zip`

构建脚本不接受参数，也不要求用户手动准备文件。首次运行需要联网下载工具链、依赖和 FFmpeg；后续构建会复用 `.build/tooling/`、下载缓存和 npm/pkg 缓存。工具链不需要每次清理；脚本会刷新隔离工作副本，并在打包前重建临时 staging，避免旧文件混入 ZIP。只有工具损坏、锁定依赖或工具版本变更后出现异常时，才需要手动删除对应缓存目录。

## GitHub Actions

`.github/workflows/build-windows.yml` 在手动触发或推送 `v*` tag 时并行构建 Windows x64 与 Linux x64 便携包。Linux job 还会构建一次 `Dockerfile`，确认容器镜像能够生成。两种触发方式都会上传 Windows ZIP 和 Linux tar.gz 作为 workflow artifact；推送 `v*` tag 时，只有两个平台都构建成功才会创建同名 GitHub Release、自动生成 release notes，并一次性上传两个便携包。手动触发只生成 workflow artifact，不会发布 Release。Actions 不提交 `.build/`，仓库中也不需要保存 FFmpeg、Node.js 工具链或编译后的前端。

## Linux x64 便携包

### 环境要求

- Linux x64，glibc 2.28 或更高版本
- Bash、Git、curl、tar 和 SHA-256 工具
- Node.js 24，用于读取构建配置；实际构建和最终产物使用脚本下载的固定 Node.js 24 运行时
- 可访问 Node.js、npm registry 和 GitHub 的网络

运行：

```bash
./build-linux-release.sh
```

脚本在 `.build/` 中下载并校验固定的 Node.js Linux x64 与 FFmpeg LGPL 归档，创建隔离的前后端工作副本，安装锁定依赖，运行 server 测试和语法检查，构建 PWA，然后生成：

```text
kikoeru-linux-x64-<6 位 commit ID>.tar.gz
```

文件名中的 commit ID 取自当前 HEAD；产品版本读取自 `server/package.json`。便携包包含 Node.js 24、生产依赖、前端文件、FFmpeg、启动脚本和许可证；用户数据默认写入解压目录下的 `data/`。

## Podman / Docker 镜像

两个容器工具共用仓库根目录的 `Dockerfile`：

```bash
podman build -t kikoeru:local .
KIKOERU_PORT=8888
podman run --rm -e PORT="$KIKOERU_PORT" -p "$KIKOERU_PORT:$KIKOERU_PORT" -v kikoeru-data:/data -v /path/to/VoiceWork:/media kikoeru:local
```

`KIKOERU_PORT` 可按需修改。镜像使用 Node.js 24，构建阶段生成 PWA 和 Linux 原生依赖，运行阶段提供 FFmpeg。配置与数据库保存在 `/data`，媒体目录挂载到 `/media`；首次启动后需要在管理设置中把根目录配置为 `/media`。
