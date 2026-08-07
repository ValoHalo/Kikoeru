# Kikoeru

Kikoeru 是用于管理和播放本地 DLsite 音声作品的自托管媒体应用。

## 快速开始

1. 从 [GitHub Releases](https://github.com/ValoHalo/Kikoeru/releases) 下载最新的 Windows x64 ZIP。
2. 解压 ZIP，运行 `start-kikoeru.cmd`。
3. 本机打开 `http://127.0.0.1:8888/`；远程设备打开 `http://<服务器 IP>:8888/`。
4. 使用默认用户名 `admin`、默认密码 `admin` 登录，并在首次登录后修改密码。

## 如何添加音声库

先把拥有的音声作品解压到一个固定的媒体目录。每个作品使用一个独立文件夹，文件夹名中应包含该作品的 DLsite RJ 编号。

例如，可以按下面的方式整理：

```text
E:\media\
├─ RJ01469493\
│  ├─ 01.flac
│  └─ 02.flac
├─ RJ01533746 作品标题\
│  └─ 本篇\
│     └─ 01.mp3
└─ 某社团\
   └─ RJ01234567\
      └─ 01.wav
```

RJ 作品文件夹请遵循以下规则：

- 推荐直接使用 DLsite 上的完整作品编号，例如 `RJ01469493`，并保留编号中的前导零。
- `RJ` 和数字之间不能有空格。`RJ01469493` 可以识别，`RJ 01469493` 和只有数字的 `01469493` 不能识别。
- 文件夹名可以在编号后附加作品标题，例如 `RJ01469493 作品标题`；为减少识别错误，建议把编号放在最前面并使用大写字母。
- 一个 RJ 文件夹只放一个作品。压缩包需要先解压，音频文件可以直接放在作品文件夹中，也可以继续按章节建立子文件夹。
- 默认可以扫描媒体根目录中的 RJ 文件夹，也可以扫描一层分类目录下的 RJ 文件夹。目录更深时，需要在“高级设置”中提高“最大递归扫描深度”。

准备好文件后，按以下步骤导入：

1. 使用管理员账号登录，进入“管理后台”中的“音声库”。
2. 填写一个便于区分的“文件夹别名”，再填写服务器能够访问的绝对路径。例如，Windows 可以填写 `E:\media`，Linux 可以填写 `/mnt/media`；使用 Docker 或 Podman 时应填写容器内路径 `/media`。
3. 点击“添加”，确认新目录出现在文件夹列表中。
4. 进入“扫描”页面，点击“扫描本地音声库”。首次扫描会识别 RJ 文件夹，并联网获取作品元数据和封面。
5. 扫描完成后返回媒体库查看作品。以后向该目录加入新作品时，再执行一次“扫描本地音声库”即可。

音频文件可以放在 RJ 文件夹内的任意子目录中，常见的 `mp3`、`flac`、`wav`、`m4a`、`aac`、`opus` 和 `ogg` 格式均可识别。

## 目录结构

```text
server/                       Express 后端源码、测试和打包器
web/                          Vue 3 / Quasar 2 前端源码
build-windows-release.ps1     Windows 一键构建入口
.github/workflows/            GitHub Actions 构建配置
```

前端生产文件、Node.js 24 工具链、npm 依赖和 FFmpeg 都由构建脚本生成或下载，统一放在仓库根目录的 `.build/`。最终 ZIP 直接生成到仓库根目录，以 commit ID 区分不同提交的构建。

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

需要热更新开发服务器时，在 `web` 目录运行 `npx quasar dev`。如果只需要构建 Windows 便携包，建议直接使用下方的一键构建脚本，由脚本准备隔离工具链。

## Windows 构建

在 Windows PowerShell 中运行：

```powershell
.\build-windows-release.ps1
```

首次构建会自动下载前端 Node.js 24 工具链和固定的 FFmpeg LGPL 构建，安装锁定依赖、运行测试并生成 ZIP。完整环境要求、构建过程和 Actions 行为见 [BUILDING.md](BUILDING.md)。

## Linux 构建与运行

在 Linux x64 上构建便携包：

```bash
./build-linux-release.sh
```

产物为仓库根目录下的 `kikoeru-linux-x64-<6 位 commit ID>.tar.gz`。解压后运行 `start-kikoeru.sh`，用户数据默认保存在同目录的 `data/`。

Podman 和 Docker 使用同一个 `Dockerfile`：

```bash
podman build -t kikoeru:local .
KIKOERU_PORT=8888
podman run --rm -e PORT="$KIKOERU_PORT" -p "$KIKOERU_PORT:$KIKOERU_PORT" -v kikoeru-data:/data -v /path/to/VoiceWork:/media kikoeru:local
```

`KIKOERU_PORT` 可按需修改。使用 Docker 时将上述命令中的 `podman` 替换为 `docker`。首次登录后，在管理设置中把媒体根目录配置为容器内的 `/media`。

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
