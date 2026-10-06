# Kikoeru

Kikoeru 一个基于 WebUI 的本地音声管理软件

**[下载 Windows / Linux 便携版](https://github.com/ValoHalo/Kikoeru/releases/latest)** | [容器运行](#容器运行)

## 主要功能

- 音声库管理
- 搜索与筛选
- 音频在线播放
- 浏览字幕
- 收藏与进度记录
- 作品浏览
- 多端与多语言

## 快速开始

1. 从 [GitHub Releases](https://github.com/ValoHalo/Kikoeru/releases) 下载适合自己系统的便携版压缩包
2. 完整解压后，Windows 运行 `start-kikoeru.cmd`，Linux 运行 `start-kikoeru.sh`
3. 本机打开 `http://127.0.0.1:8888/`，其他设备打开 `http://<服务器 IP>:8888/`
4. 使用默认用户名 `admin`、默认密码 `admin` 登录
5. 根据首次初始化页面的指示完成配置
6. 进入管理设置中的音声库页面，点击页面下方的“扫描本地音声库”按钮，完成首次扫描

## 关于音声库

建议选择一个固定的媒体目录保存音声，每部作品使用独立文件夹，DLsite 作品的文件夹名中应包含对应的 RJ、BJ 或 VJ 编号

下面只是几个示例，实际使用时可以自行整理，只要你觉得没问题就可以

```text
E:\media\
├─ RJ01610397\
├─ RJ01355336 作品标题\
└─ 社团名\
   ├─ RJ01355336\
   └─ RJ01610397\
```

常见的 `mp3`、`flac`、`wav`、`m4a`、`aac`、`opus`、`ogg` 格式音频均可识别，作品中若有 `mp4` 视频也可以在大图模式下播放画面

本地字幕支持 `lrc`、`vtt`、`srt`、`ass` 等格式

## 更新

Windows 和 Linux 便携版可以在“管理设置 / 更新”中检查、下载并安装最新的 GitHub Release，安装操作需要由管理员进行

容器部署通过拉取新镜像并重新创建容器完成更新，更新时保留原有的 `/data` 数据卷和媒体目录挂载

## 容器运行

容器镜像发布在 [ghcr.io](https://ghcr.io/valohalo/kikoeru)，Podman 示例

```bash
KIKOERU_PORT=8888
podman run -d --name kikoeru \
  -e PORT="$KIKOERU_PORT" \
  -p "$KIKOERU_PORT:$KIKOERU_PORT" \
  -v kikoeru-data:/data \
  -v /path/to/VoiceWork:/media \
  ghcr.io/valohalo/kikoeru:latest
```

`KIKOERU_PORT` 可按需修改，使用 Docker 时将命令中的 `podman` 替换为 `docker`

首次登录后，在初始化页面中把媒体目录配置为容器内的 `/media`


## 致谢

- [kikoeru-express](https://github.com/Number178/kikoeru-express) 及其 [Docker 镜像](https://hub.docker.com/r/number17/kikoeru)：上游后端，本项目基于 Docker 镜像中的代码进行修改
- [kikoeru-quasar](https://github.com/Number178/kikoeru-quasar)：上游前端，适配新版本后端后继续调整
- ASMR ONE：参考了部分交互和设置项
- ChatGPT / Codex

## 声明

本项目用于管理用户合法持有的本地音声资料，本身不提供音声资源

程序作者与使用本程序的内容提供商没有联系，不为其提供技术支持，也不为其侵权或其他不当使用承担法律责任

## 许可协议

源码采用 [GNU General Public License v3.0](https://github.com/ValoHalo/Kikoeru/blob/main/LICENSE)
