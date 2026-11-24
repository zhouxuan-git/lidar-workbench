# 点云工作台

在浏览器中浏览、对比和测量三维点云。公开演示包含办公室、会议室、走廊、休息区和储藏室五个合成场景。

每次打开或刷新都从英文开始，右上角可在当前页面切换中文。向下滚动时，页首字标由 LiDAR Workbench 缩成 LW。

## 双栏对比

- 左右两侧可独立选择场景、原色、语义或高度。右侧选择「同左侧」可对比同一场景的两种着色。
- 「同步视角」同时联动旋转、平移和缩放。关掉后可分别调整两侧视角。
- 两侧都可选本次会话导入的点云。剖切和点大小作用于两侧，类别筛选、拾取和测距作用于左侧。
- 双栏模式下导出的 PNG 包含左右视图。

## 手机操作

- 单指拖动旋转，双指捏合缩放，双指一起拖动平移。
- 轻点拾取点位。测距模式下，依次轻点两个点。
- 在支持 WebGL 的浏览器打开，推荐 iPhone 使用 Safari，安卓使用 Chrome。

## 本地点云

点击「导入点云」可读取 PLY、PCD、XYZ、TXT 或 CSV。用「打开场景库」可以选择本地工作台的 `data` 文件夹来浏览 S3DIS。读取和渲染在当前浏览器内完成，仓库内的示例场景由代码生成。

「打开数据包」支持预处理的 `.lidar` 场景库，按房间读取。大型文本点云分块读取，大型未压缩二进制 PLY 和 PCD 按段抽样，每个视图最多渲染 50 万点。

English typography uses DM Sans and Newsreader under the SIL Open Font License. See [DM Sans](DM-Sans-OFL.txt) and [Newsreader](Newsreader-OFL.txt).

## GitHub Pages

将本仓库的 `main` 分支设置为发布源。在仓库的 **Settings → Pages** 中选择 **Deploy from a branch**，分支选 `main`，目录选 **/(root)**。发布后在 Pages 设置页可看到站点地址。
