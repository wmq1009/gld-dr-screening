"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type Answer = "" | "Yes" | "No" | "Unclear";
type Conclusion = "" | "Include" | "Exclude" | "Unclear";
type Status = "Not started" | "In progress" | "Completed";

type Article = {
  coreID: string;
  title: string;
  authors: string;
  journal: string;
  year: string;
  doi: string;
  abstract: string;
  full_text_url: string;
  pdf_filename: string;
  reviewer: string;
  original: Record<string, string>;
};

type ScreeningRecord = {
  population_eligible: Answer;
  exposure_comparator_eligible: Answer;
  retinal_outcome_eligible: Answer;
  design_methodology_eligible: Answer;
  overall_conclusion: Conclusion;
  screening_comments: string;
  reviewer: string;
  screened_at: string;
  last_modified_at: string;
};

type Filter = "All" | "Not started" | "In progress" | "Include" | "Exclude" | "Unclear";

const EMPTY_RECORD: ScreeningRecord = {
  population_eligible: "",
  exposure_comparator_eligible: "",
  retinal_outcome_eligible: "",
  design_methodology_eligible: "",
  overall_conclusion: "",
  screening_comments: "",
  reviewer: "",
  screened_at: "",
  last_modified_at: "",
};

const SAMPLE_ARTICLES: Article[] = [
  {
    coreID: "10025",
    title: "Association between SGLT2 inhibitor use and diabetic retinopathy outcomes in adults with type 2 diabetes",
    authors: "Chen Y, Wang L, Zhao H",
    journal: "Diabetes Research and Clinical Practice",
    year: "2024",
    doi: "10.1016/j.diabres.2024.111001",
    abstract: "A comparative cohort study evaluating retinal outcomes among adults with type 2 diabetes initiating glucose-lowering therapies.",
    full_text_url: "",
    pdf_filename: "10025.pdf",
    reviewer: "",
    original: {
      coreID: "10025",
      title: "Association between SGLT2 inhibitor use and diabetic retinopathy outcomes in adults with type 2 diabetes",
      authors: "Chen Y, Wang L, Zhao H",
      journal: "Diabetes Research and Clinical Practice",
      year: "2024",
      doi: "10.1016/j.diabres.2024.111001",
    },
  },
  {
    coreID: "10026",
    title: "Glucagon-like peptide-1 receptor agonists and progression of diabetic eye disease",
    authors: "Martinez P, Green J, Patel R",
    journal: "Diabetologia",
    year: "2023",
    doi: "",
    abstract: "This randomized trial reports prespecified diabetic retinopathy events during follow-up.",
    full_text_url: "",
    pdf_filename: "10026.pdf",
    reviewer: "",
    original: {
      coreID: "10026",
      title: "Glucagon-like peptide-1 receptor agonists and progression of diabetic eye disease",
      authors: "Martinez P, Green J, Patel R",
      journal: "Diabetologia",
      year: "2023",
    },
  },
  {
    coreID: "10027",
    title: "Insulin exposure and microvascular complications: a population-based analysis",
    authors: "Smith A, Liu Q",
    journal: "BMJ Open Diabetes Research & Care",
    year: "2021",
    doi: "",
    abstract: "A population-based observational analysis of glucose-lowering therapy and microvascular outcomes.",
    full_text_url: "",
    pdf_filename: "10027.pdf",
    reviewer: "",
    original: {
      coreID: "10027",
      title: "Insulin exposure and microvascular complications: a population-based analysis",
      authors: "Smith A, Liu Q",
      journal: "BMJ Open Diabetes Research & Care",
      year: "2021",
    },
  },
];

const QUESTIONS: Array<{
  key: keyof Pick<
    ScreeningRecord,
    | "population_eligible"
    | "exposure_comparator_eligible"
    | "retinal_outcome_eligible"
    | "design_methodology_eligible"
  >;
  label: string;
  title: string;
  hint: string;
}> = [
  {
    key: "population_eligible",
    label: "Q1 · Population",
    title: "研究对象是否为成人 2 型糖尿病患者，或能够单独提取成人 T2DM 结果？",
    hint: "仅有1型糖尿病、妊娠期糖尿病、其他特殊类型或非人类研究选择 No。",
  },
  {
    key: "exposure_comparator_eligible",
    label: "Q2 · Intervention / Exposure and Comparator",
    title: "研究是否评价降糖药，并设有可识别的比较组？",
    hint: "降糖药包括各类 GLD；比较组可为其他药物、安慰剂、标准治疗或未治疗组。",
  },
  {
    key: "retinal_outcome_eligible",
    label: "Q3 · Outcome",
    title: "研究是否报告可以单独识别的糖尿病视网膜相关结局？",
    hint: "复合结局中的视网膜结局无法单独提取时选择 No。",
  },
  {
    key: "design_methodology_eligible",
    label: "Q4 · Study design and methodological information",
    title: "研究是否为 RCT 或有比较组的观察性研究，并具有足够的方法学信息？",
    hint: "横断面研究、综述、评论、会议摘要及无原始比较数据的研究选择 No。",
  },
];

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"') {
      if (quoted && next === '"') {
        value += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      row.push(value);
      value = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(value);
      if (row.some((cell) => cell !== "")) rows.push(row);
      row = [];
      value = "";
    } else {
      value += char;
    }
  }

  row.push(value);
  if (row.some((cell) => cell !== "")) rows.push(row);
  return rows;
}

function quoteCSV(value: unknown) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function getSuggested(record: ScreeningRecord): Exclude<Conclusion, ""> {
  const answers = QUESTIONS.map((question) => record[question.key]);
  if (answers.includes("No")) return "Exclude";
  if (answers.includes("") || answers.includes("Unclear")) return "Unclear";
  return "Include";
}

function getStatus(record: ScreeningRecord): Status {
  const answers = QUESTIONS.map((question) => record[question.key]);
  const allEmpty = answers.every((answer) => answer === "") && record.overall_conclusion === "";
  if (allEmpty) return "Not started";
  if (answers.every((answer) => answer !== "") && record.overall_conclusion !== "") return "Completed";
  return "In progress";
}

function getExclusionReason(record: ScreeningRecord) {
  if (record.overall_conclusion !== "Exclude") return "";
  const labels: Record<(typeof QUESTIONS)[number]["key"], string> = {
    population_eligible: "Population",
    exposure_comparator_eligible: "Intervention/Exposure or Comparator",
    retinal_outcome_eligible: "Outcome",
    design_methodology_eligible: "Study design or methodological information",
  };
  return QUESTIONS.filter((question) => record[question.key] === "No")
    .map((question) => labels[question.key])
    .join("; ");
}

function normaliseName(value: string) {
  return value.trim().toLocaleLowerCase();
}

function articleFromRow(headers: string[], row: string[]): Article {
  const original: Record<string, string> = {};
  headers.forEach((header, index) => {
    original[header] = row[index] ?? "";
  });
  const byLower = new Map(headers.map((header) => [header.trim().toLowerCase(), header]));
  const field = (name: string) => original[byLower.get(name.toLowerCase()) ?? ""] ?? "";
  return {
    coreID: field("coreid"),
    title: field("title"),
    authors: field("authors"),
    journal: field("journal"),
    year: field("year"),
    doi: field("doi"),
    abstract: field("abstract"),
    full_text_url: field("full_text_url"),
    pdf_filename: field("pdf_filename"),
    reviewer: field("reviewer"),
    original,
  };
}

export default function Home() {
  const [articles, setArticles] = useState<Article[]>(SAMPLE_ARTICLES);
  const [records, setRecords] = useState<Record<string, ScreeningRecord>>({});
  const [index, setIndex] = useState(0);
  const [draft, setDraft] = useState<ScreeningRecord>(EMPTY_RECORD);
  const [filter, setFilter] = useState<Filter>("All");
  const [jumpID, setJumpID] = useState("");
  const [jumpIndex, setJumpIndex] = useState("1");
  const [csvName, setCsvName] = useState("示例数据（可导入 CSV 替换）");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pdfFiles, setPdfFiles] = useState<Map<string, File>>(new Map());
  const [pdfURL, setPdfURL] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const csvInput = useRef<HTMLInputElement>(null);
  const pdfInput = useRef<HTMLInputElement>(null);
  const backupInput = useRef<HTMLInputElement>(null);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);

  useEffect(() => {
    try {
      const storedArticles = localStorage.getItem("gld-dr-articles");
      const storedRecords = localStorage.getItem("gld-dr-records");
      const storedName = localStorage.getItem("gld-dr-csv-name");
      if (storedArticles) setArticles(JSON.parse(storedArticles));
      if (storedRecords) setRecords(JSON.parse(storedRecords));
      if (storedName) setCsvName(storedName);
    } catch {
      setNotice("无法读取浏览器中的历史进度，当前显示示例数据。");
    }
  }, []);

  useEffect(() => {
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register(`${basePath}/sw.js`).catch(() => undefined);
    }
    const captureInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", captureInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", captureInstallPrompt);
  }, []);

  const current = articles[index] ?? SAMPLE_ARTICLES[0];

  useEffect(() => {
    const saved = records[current?.coreID];
    setDraft(saved ? { ...EMPTY_RECORD, ...saved } : { ...EMPTY_RECORD, reviewer: current?.reviewer ?? "" });
    setIsDirty(false);
    setJumpIndex(String(index + 1));
    setJumpID(current?.coreID ?? "");
  }, [current?.coreID, current?.reviewer, index, records]);

  useEffect(() => {
    if (!current) return;
    if (pdfURL) URL.revokeObjectURL(pdfURL);
    const desired = normaliseName(current.pdf_filename || `${current.coreID}.pdf`);
    const fallback = normaliseName(`${current.coreID}.pdf`);
    const file = pdfFiles.get(desired) ?? pdfFiles.get(fallback);
    const next = file ? URL.createObjectURL(file) : "";
    setPdfURL(next);
    return () => {
      if (next) URL.revokeObjectURL(next);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.coreID, current?.pdf_filename, pdfFiles]);

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [isDirty]);

  const visibleIndices = useMemo(() => {
    return articles
      .map((article, articleIndex) => ({ article, articleIndex }))
      .filter(({ article }) => {
        if (filter === "All") return true;
        const record = records[article.coreID] ?? EMPTY_RECORD;
        if (filter === "Not started" || filter === "In progress") return getStatus(record) === filter;
        return record.overall_conclusion === filter;
      })
      .map(({ articleIndex }) => articleIndex);
  }, [articles, filter, records]);

  const summary = useMemo(() => {
    const values = articles.map((article) => records[article.coreID] ?? EMPTY_RECORD);
    return {
      completed: values.filter((record) => getStatus(record) === "Completed").length,
      include: values.filter((record) => record.overall_conclusion === "Include").length,
      exclude: values.filter((record) => record.overall_conclusion === "Exclude").length,
      unclear: values.filter((record) => record.overall_conclusion === "Unclear").length,
    };
  }, [articles, records]);

  const suggested = getSuggested(draft);
  const completion = articles.length ? Math.round((summary.completed / articles.length) * 100) : 0;

  function confirmLeave() {
    return !isDirty || window.confirm("当前修改尚未保存。确定离开这篇文献吗？");
  }

  function goTo(nextIndex: number) {
    if (nextIndex < 0 || nextIndex >= articles.length || !confirmLeave()) return;
    setIndex(nextIndex);
    setNotice("");
  }

  function adjacent(direction: -1 | 1) {
    const position = visibleIndices.indexOf(index);
    const fallbackPosition = direction === 1 ? -1 : visibleIndices.length;
    const target = visibleIndices[(position === -1 ? fallbackPosition : position) + direction];
    if (target !== undefined) goTo(target);
  }

  function updateDraft(patch: Partial<ScreeningRecord>) {
    setDraft((previous) => ({ ...previous, ...patch }));
    setIsDirty(true);
    setNotice("");
  }

  function persistArticles(nextArticles: Article[], name: string) {
    setArticles(nextArticles);
    setCsvName(name);
    setIndex(0);
    setFilter("All");
    localStorage.setItem("gld-dr-articles", JSON.stringify(nextArticles));
    localStorage.setItem("gld-dr-csv-name", name);
  }

  async function handleCSV(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !confirmLeave()) return;
    setError("");
    try {
      const text = (await file.text()).replace(/^\uFEFF/, "");
      const rows = parseCSV(text);
      if (rows.length < 2) throw new Error("CSV 中没有可导入的文献记录。");
      const headers = rows[0].map((header) => header.trim());
      if (!headers.some((header) => header.toLowerCase() === "coreid")) {
        throw new Error("CSV 中缺少必需字段 coreID。");
      }
      const imported = rows.slice(1).map((row) => articleFromRow(headers, row));
      const counts = new Map<string, number>();
      imported.forEach((article) => counts.set(article.coreID, (counts.get(article.coreID) ?? 0) + 1));
      const duplicates = [...counts.entries()].filter(([, count]) => count > 1).map(([id]) => id);
      if (duplicates.length) {
        throw new Error(`发现重复 coreID：${duplicates.join("、")}。请修正 CSV 后重新导入。`);
      }
      if (imported.some((article) => article.coreID === "")) {
        throw new Error("CSV 中存在空白 coreID，请修正后重新导入。");
      }
      persistArticles(imported, file.name);
      setNotice(`已导入 ${imported.length} 篇文献。`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "CSV 导入失败。");
    }
  }

  function handlePDFs(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []).filter((file) => file.name.toLowerCase().endsWith(".pdf"));
    const next = new Map<string, File>();
    files.forEach((file) => next.set(normaliseName(file.name), file));
    setPdfFiles(next);
    setNotice(`已读取 ${files.length} 个 PDF；文件仅保留在当前浏览器会话中。`);
  }

  function save(moveNext = false) {
    if (!current) return;
    const now = new Date().toISOString();
    const completed = getStatus(draft) === "Completed";
    const nextRecord: ScreeningRecord = {
      ...draft,
      screened_at: completed ? draft.screened_at || now : draft.screened_at,
      last_modified_at: now,
    };
    const nextRecords = { ...records, [current.coreID]: nextRecord };
    setRecords(nextRecords);
    localStorage.setItem("gld-dr-records", JSON.stringify(nextRecords));
    setIsDirty(false);
    setNotice("已保存到当前浏览器。");
    if (moveNext) {
      const currentPosition = visibleIndices.indexOf(index);
      const nextIndex = visibleIndices[currentPosition + 1] ?? (index + 1 < articles.length ? index + 1 : undefined);
      if (nextIndex !== undefined) setTimeout(() => setIndex(nextIndex), 0);
    }
  }

  function jumpByID() {
    const target = articles.findIndex((article) => article.coreID === jumpID.trim());
    if (target === -1) {
      setError("未找到该 Core ID。");
      return;
    }
    setError("");
    goTo(target);
  }

  function jumpByIndex() {
    const target = Number(jumpIndex) - 1;
    if (!Number.isInteger(target) || target < 0 || target >= articles.length) {
      setError(`请输入 1–${articles.length} 之间的序号。`);
      return;
    }
    setError("");
    goTo(target);
  }

  function exportCSV(mode: "all" | "completed" | "included" | "excluded" | "unclear") {
    const selected = articles.filter((article) => {
      const record = records[article.coreID] ?? EMPTY_RECORD;
      if (mode === "completed") return getStatus(record) === "Completed";
      if (mode === "included") return record.overall_conclusion === "Include";
      if (mode === "excluded") return record.overall_conclusion === "Exclude";
      if (mode === "unclear") return record.overall_conclusion === "Unclear";
      return true;
    });
    if (!selected.length) {
      setError("当前导出条件下没有记录。");
      return;
    }
    const originalHeaders = Object.keys(articles[0]?.original ?? {});
    const addedHeaders = [
      "population_eligible",
      "exposure_comparator_eligible",
      "retinal_outcome_eligible",
      "design_methodology_eligible",
      "suggested_conclusion",
      "overall_conclusion",
      "exclusion_reason",
      "screening_comments",
      "screening_status",
      "reviewer",
      "screened_at",
      "last_modified_at",
    ];
    const headers = [...originalHeaders.filter((header) => !addedHeaders.includes(header)), ...addedHeaders];
    const lines = [
      headers.map(quoteCSV).join(","),
      ...selected.map((article) => {
        const record = records[article.coreID] ?? EMPTY_RECORD;
        const values: Record<string, string> = {
          ...article.original,
          ...record,
          suggested_conclusion: getSuggested(record),
          exclusion_reason: getExclusionReason(record),
          screening_status: getStatus(record),
          reviewer: record.reviewer || article.reviewer,
        };
        return headers.map((header) => quoteCSV(values[header])).join(",");
      }),
    ];
    const blob = new Blob(["\uFEFF", lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const stamp = new Date()
      .toISOString()
      .replaceAll("-", "")
      .replace("T", "_")
      .replaceAll(":", "")
      .slice(0, 15);
    link.href = url;
    link.download = `full_text_screening_results_${stamp}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function exportBackup() {
    const stamp = new Date().toISOString().replaceAll("-", "").replace("T", "_").replaceAll(":", "").slice(0, 15);
    const payload = JSON.stringify({
      format: "gld-dr-fulltext-screening-backup",
      version: 1,
      exported_at: new Date().toISOString(),
      csv_name: csvName,
      articles,
      records,
    }, null, 2);
    const url = URL.createObjectURL(new Blob([payload], { type: "application/json;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `full_text_screening_backup_${stamp}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setNotice("项目备份已导出，可在另一台电脑中导入继续筛选。");
  }

  async function importBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !confirmLeave()) return;
    setError("");
    try {
      const payload = JSON.parse(await file.text()) as {
        format?: string;
        csv_name?: string;
        articles?: Article[];
        records?: Record<string, ScreeningRecord>;
      };
      if (payload.format !== "gld-dr-fulltext-screening-backup" || !Array.isArray(payload.articles) || !payload.records) {
        throw new Error("这不是有效的全文筛选项目备份。");
      }
      const ids = payload.articles.map((article) => article.coreID);
      if (!ids.length || ids.some((id) => !id) || new Set(ids).size !== ids.length) {
        throw new Error("备份中的 coreID 缺失或重复，无法导入。");
      }
      setArticles(payload.articles);
      setRecords(payload.records);
      setCsvName(payload.csv_name || file.name);
      setIndex(0);
      setFilter("All");
      localStorage.setItem("gld-dr-articles", JSON.stringify(payload.articles));
      localStorage.setItem("gld-dr-records", JSON.stringify(payload.records));
      localStorage.setItem("gld-dr-csv-name", payload.csv_name || file.name);
      setNotice(`已恢复 ${payload.articles.length} 篇文献及全部筛选进度。PDF 文件夹需重新选择。`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "项目备份导入失败。");
    }
  }

  async function installApp() {
    if (!installPrompt) {
      setNotice("可使用浏览器菜单中的“安装此应用”或“创建快捷方式”，将本工具安装到桌面。");
      return;
    }
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  }

  const mismatch = draft.overall_conclusion !== "" && draft.overall_conclusion !== suggested;
  const reminders = [
    draft.overall_conclusion === "Unclear" && !draft.screening_comments.trim()
      ? "结论为 Unclear，建议在评论中记录需要核实的信息。"
      : "",
    mismatch ? "最终结论与系统建议不同，请在评论中简要说明。" : "",
    draft.overall_conclusion === "Exclude" &&
    QUESTIONS.every((question) => draft[question.key] !== "No")
      ? "当前选择 Exclude，但四个问题中没有 No。"
      : "",
  ].filter(Boolean);

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">DECIDE STUDY · LOCAL SCREENING WORKSPACE</p>
          <h1>全文筛选工作台</h1>
        </div>
        <div className="topbar-actions">
          <button className="install-button" onClick={installApp}>安装到桌面</button>
          <div className="privacy-badge"><span /> 数据仅保存在当前浏览器</div>
        </div>
      </header>

      <div className="workspace">
        <aside className="sidebar">
          <section className="side-section project-section">
            <p className="side-label">当前项目</p>
            <strong>{csvName}</strong>
            <span>{articles.length} 篇文献</span>
            <div className="file-actions">
              <button className="primary-button full" onClick={() => csvInput.current?.click()}>
                导入 CSV
              </button>
              <button className="secondary-button full" onClick={() => pdfInput.current?.click()}>
                选择 PDF 文件夹
              </button>
            </div>
            <input ref={csvInput} hidden type="file" accept=".csv,text/csv" onChange={handleCSV} />
            <input
              ref={pdfInput}
              hidden
              type="file"
              accept=".pdf,application/pdf"
              multiple
              // @ts-expect-error Chromium directory picker
              webkitdirectory=""
              onChange={handlePDFs}
            />
            <p className="microcopy">PDF 按 coreID 自动匹配；重新打开页面后需再次选择 PDF 文件夹。</p>
          </section>

          <section className="side-section">
            <div className="progress-heading">
              <div>
                <p className="side-label">项目进度</p>
                <strong>{summary.completed} / {articles.length}</strong>
              </div>
              <span>{completion}%</span>
            </div>
            <div className="progress-track"><span style={{ width: `${completion}%` }} /></div>
            <div className="stats-grid">
              <button onClick={() => setFilter("Include")}><strong>{summary.include}</strong><span>Include</span></button>
              <button onClick={() => setFilter("Exclude")}><strong>{summary.exclude}</strong><span>Exclude</span></button>
              <button onClick={() => setFilter("Unclear")}><strong>{summary.unclear}</strong><span>Unclear</span></button>
            </div>
          </section>

          <section className="side-section">
            <label className="side-label" htmlFor="filter">筛选状态</label>
            <select id="filter" value={filter} onChange={(event) => setFilter(event.target.value as Filter)}>
              <option value="All">全部文献</option>
              <option value="Not started">仅查看未开始</option>
              <option value="In progress">仅查看进行中</option>
              <option value="Include">仅查看 Include</option>
              <option value="Exclude">仅查看 Exclude</option>
              <option value="Unclear">仅查看 Unclear</option>
            </select>
            <p className="microcopy">当前条件下共 {visibleIndices.length} 篇</p>
          </section>

          <section className="side-section jump-section">
            <p className="side-label">快速跳转</p>
            <div className="inline-field">
              <input aria-label="按 Core ID 跳转" value={jumpID} onChange={(event) => setJumpID(event.target.value)} />
              <button onClick={jumpByID}>Core ID</button>
            </div>
            <div className="inline-field">
              <input aria-label="按序号跳转" type="number" min="1" max={articles.length} value={jumpIndex} onChange={(event) => setJumpIndex(event.target.value)} />
              <button onClick={jumpByIndex}>序号</button>
            </div>
          </section>

          <section className="side-section export-section">
            <p className="side-label">导出结果</p>
            <div className="export-grid">
              <button onClick={() => exportCSV("all")}>全部</button>
              <button onClick={() => exportCSV("completed")}>已完成</button>
              <button onClick={() => exportCSV("included")}>纳入</button>
              <button onClick={() => exportCSV("excluded")}>排除</button>
              <button onClick={() => exportCSV("unclear")}>不确定</button>
            </div>
            <div className="backup-actions">
              <button onClick={exportBackup}>导出项目备份</button>
              <button onClick={() => backupInput.current?.click()}>导入项目备份</button>
            </div>
            <input ref={backupInput} hidden type="file" accept=".json,application/json" onChange={importBackup} />
            <p className="microcopy">备份包含文献列表与全部筛选进度，可转存到其他电脑。</p>
          </section>
        </aside>

        <section className="main-panel">
          {(error || notice) && (
            <div className={`toast ${error ? "error" : "success"}`}>
              <span>{error || notice}</span>
              <button aria-label="关闭提示" onClick={() => { setError(""); setNotice(""); }}>×</button>
            </div>
          )}

          <div className="article-head">
            <div className="article-meta-top">
              <span className="core-badge">CORE ID&nbsp; {current.coreID}</span>
              <span className="position">第 {index + 1} / {articles.length} 篇</span>
              <span className={`status-pill ${getStatus(draft).replace(" ", "-").toLowerCase()}`}>
                {getStatus(draft)}
              </span>
            </div>
            <h2>{current.title || "未报告题目"}</h2>
            <p>{current.authors || "未报告作者"} <i /> {current.journal || "未报告期刊"} <i /> {current.year || "未报告年份"}</p>
            <div className="article-links">
              {current.abstract && <details><summary>查看摘要</summary><p>{current.abstract}</p></details>}
              {current.doi && <a href={`https://doi.org/${current.doi}`} target="_blank" rel="noreferrer">DOI ↗</a>}
              {current.full_text_url && <a href={current.full_text_url} target="_blank" rel="noreferrer">全文链接 ↗</a>}
            </div>
          </div>

          <div className="screening-layout">
            <section className="pdf-column">
              <div className="section-title-row">
                <div>
                  <p className="section-kicker">FULL TEXT</p>
                  <h3>PDF 预览</h3>
                </div>
                <span className={`pdf-status ${pdfURL ? "found" : ""}`}>
                  <b /> {pdfURL ? "已找到 PDF" : "未找到 PDF"}
                </span>
              </div>
              <div className="pdf-viewer">
                {pdfURL ? (
                  <object data={pdfURL} type="application/pdf">
                    <p>浏览器无法嵌入 PDF，请使用下方按钮打开。</p>
                  </object>
                ) : (
                  <div className="empty-pdf">
                    <div className="document-mark"><span>PDF</span></div>
                    <strong>未找到与 coreID 对应的 PDF 文件</strong>
                    <p>预期文件名：{current.pdf_filename || `${current.coreID}.pdf`}</p>
                    <button className="secondary-button" onClick={() => pdfInput.current?.click()}>选择 PDF 文件夹</button>
                  </div>
                )}
              </div>
              {pdfURL && <a className="open-pdf" href={pdfURL} target="_blank" rel="noreferrer">在新窗口打开 PDF ↗</a>}
            </section>

            <section className="form-column">
              <div className="section-title-row">
                <div>
                  <p className="section-kicker">ELIGIBILITY</p>
                  <h3>筛选判断</h3>
                </div>
                {isDirty && <span className="dirty-badge">有未保存修改</span>}
              </div>

              <details className="criteria">
                <summary>查看完整筛选标准</summary>
                <div className="criteria-content">
                  <div>
                    <h4>纳入条件</h4>
                    <ol>
                      <li>成人 2 型糖尿病患者；</li>
                      <li>评价任意降糖药或降糖药类别；</li>
                      <li>存在其他降糖药、安慰剂、标准治疗、活性比较药物或无治疗组；</li>
                      <li>报告糖尿病视网膜病变或糖尿病相关视网膜结局；</li>
                      <li>RCT 或观察性比较研究。</li>
                    </ol>
                    <p><strong>药物：</strong>SGLT2i、GLP-1RA、DPP-4i、Metformin、Insulin、Sulfonylureas、TZD 等。</p>
                    <p><strong>结局：</strong>DR 发生或进展、DME、PDR、威胁视力 DR、激光、玻切、玻璃体腔注射等。</p>
                  </div>
                  <div>
                    <h4>排除条件</h4>
                    <ol>
                      <li>仅1型、妊娠期或其他特殊类型糖尿病；</li>
                      <li>混合人群无法单独提取 T2DM；</li>
                      <li>无比较组或横断面研究；</li>
                      <li>综述、社论、评论或会议摘要；</li>
                      <li>视网膜结局无法单独分离；</li>
                      <li>方法学信息不足；</li>
                      <li>非人类研究。</li>
                    </ol>
                  </div>
                </div>
              </details>

              <div className="questions">
                {QUESTIONS.map((question) => (
                  <fieldset className="question-card" key={question.key}>
                    <legend>{question.label}</legend>
                    <p className="question-title">{question.title}</p>
                    <div className="segmented">
                      {(["Yes", "No", "Unclear"] as Answer[]).map((answer) => (
                        <label key={answer} className={draft[question.key] === answer ? `selected ${answer.toLowerCase()}` : ""}>
                          <input
                            type="radio"
                            name={question.key}
                            value={answer}
                            checked={draft[question.key] === answer}
                            onChange={() => updateDraft({ [question.key]: answer })}
                          />
                          {answer}
                        </label>
                      ))}
                    </div>
                    <p className="hint">{question.hint}</p>
                  </fieldset>
                ))}
              </div>

              <section className="conclusion-card">
                <div className="suggestion">
                  <span>系统建议</span>
                  <strong className={suggested.toLowerCase()}>{suggested}</strong>
                  <small>根据前四项自动生成</small>
                </div>
                <h4>Overall conclusion</h4>
                <div className="conclusion-options">
                  {(["Include", "Exclude", "Unclear"] as Conclusion[]).map((answer) => (
                    <label key={answer} className={draft.overall_conclusion === answer ? `selected ${answer.toLowerCase()}` : ""}>
                      <input
                        type="radio"
                        name="overall_conclusion"
                        value={answer}
                        checked={draft.overall_conclusion === answer}
                        onChange={() => updateDraft({ overall_conclusion: answer })}
                      />
                      <span>{answer}</span>
                    </label>
                  ))}
                </div>
              </section>

              {reminders.length > 0 && (
                <div className="reminders">
                  {reminders.map((reminder) => <p key={reminder}>○ {reminder}</p>)}
                </div>
              )}

              <label className="comments-label" htmlFor="comments">
                <span>Comments / Uncertainty notes</span>
                <textarea
                  id="comments"
                  value={draft.screening_comments}
                  onChange={(event) => updateDraft({ screening_comments: event.target.value })}
                  placeholder="记录判断依据、需要核实的信息或不确定之处。"
                />
              </label>

              <label className="reviewer-field">
                <span>Reviewer</span>
                <input value={draft.reviewer} onChange={(event) => updateDraft({ reviewer: event.target.value })} placeholder="可选" />
              </label>
            </section>
          </div>

          <footer className="action-bar">
            <div>
              <button className="text-button" onClick={() => adjacent(-1)} disabled={visibleIndices.indexOf(index) <= 0}>← Previous</button>
              <button className="text-button" onClick={() => adjacent(1)} disabled={visibleIndices.indexOf(index) === visibleIndices.length - 1}>Next →</button>
            </div>
            <div>
              <span className="save-state">{isDirty ? "尚未保存" : "所有修改已保存"}</span>
              <button className="secondary-button" onClick={() => save(false)}>Save</button>
              <button className="primary-button" onClick={() => save(true)}>Save and next</button>
            </div>
          </footer>
        </section>
      </div>
    </main>
  );
}
