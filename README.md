# GLD & DR 全文筛选工作台

用于“降糖药与糖尿病视网膜病变或相关视网膜结局”系统综述的浏览器端全文筛选工具。

在线地址：<https://wmq1009.github.io/gld-dr-screening/>

## 主要功能

- 导入 CSV，并以 `coreID` 作为唯一标识
- 按 `coreID.pdf` 或 CSV 中的 `pdf_filename` 关联本地 PDF
- 四项全文筛选问题与自动建议结论
- 手动选择 Include、Exclude 或 Unclear
- 保存筛选进度并按状态筛选、跳转
- 导出全部、已完成、纳入、排除或不确定记录
- 导出和导入 JSON 项目备份，在不同电脑间转存进度
- 支持安装为桌面 PWA

## 数据安全

All screening data remain on the local computer.

CSV、PDF 与筛选结果均由浏览器在本地处理，不会上传到本仓库或外部数据库，也不会调用外部 AI API。筛选进度存储在当前浏览器的 `localStorage` 中。更换电脑或浏览器前，请先使用“导出项目备份”。

PDF 不包含在 JSON 项目备份中，迁移后需要重新选择本地 PDF 文件夹。

## CSV 字段

必需字段：

- `coreID`

推荐字段：

- `title`
- `authors`
- `journal`
- `year`

可选字段：

- `doi`
- `abstract`
- `full_text_url`
- `pdf_filename`
- `reviewer`

字段名匹配不区分大小写。重复或空白 `coreID` 会阻止导入，程序不会自动修改编号。

## 部署

`.github/workflows/deploy-pages.yml` 会在提交到 `main` 分支后自动构建和部署 GitHub Pages。其他用户只需浏览器，不需要安装 Python、Node.js 或其他软件。

本地开发：

```bash
npm ci
npm run dev
```

静态构建：

```bash
NEXT_PUBLIC_BASE_PATH=/gld-dr-screening npm run build
```
