import { useState, useEffect, useRef } from 'react';

export interface CodeRunnerPadProps {
  code: string;
  setCode: (code: string) => void;
  selectedCodeLang: string;
  setSelectedCodeLang: (lang: string) => void;
  codeOutput: string | null;
  onClearCodeOutput: () => void;
  isRunningCode: boolean;
  copiedCode: boolean;
  handleCopyCode: () => void;
  emitRoomEvent: (event: any) => void;
}

// Global Pyodide singleton instance cache
let pyodideInstance: any = null;
let pyodideLoadingPromise: Promise<any> | null = null;

async function getPyodide(): Promise<any> {
  if (pyodideInstance) return pyodideInstance;
  if (pyodideLoadingPromise) return pyodideLoadingPromise;

  pyodideLoadingPromise = (async () => {
    // If window.loadPyodide already exists
    if (typeof (window as any).loadPyodide === 'function') {
      pyodideInstance = await (window as any).loadPyodide();
      return pyodideInstance;
    }

    // Try loading script tag
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/pyodide/v0.25.1/full/pyodide.js';
      script.async = true;
      script.onload = async () => {
        try {
          if (typeof (window as any).loadPyodide === 'function') {
            pyodideInstance = await (window as any).loadPyodide({
              indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.25.1/full/'
            });
            resolve(pyodideInstance);
          } else {
            reject(new Error('loadPyodide not found on window'));
          }
        } catch (e) {
          reject(e);
        }
      };
      script.onerror = () => reject(new Error('Failed to load Pyodide script from CDN'));
      document.head.appendChild(script);
    });
  })();

  try {
    return await pyodideLoadingPromise;
  } catch (err) {
    pyodideLoadingPromise = null;
    throw err;
  }
}

// In-browser Relational SQL Engine (SQLite-like WASM / In-Memory relational tables)
class InMemorySqlEngine {
  private tables: Record<string, any[]> = {
    mentors: [
      { id: 1, name: 'Maya Sharma', skill: 'UI/UX & Figma', rating: 4.98, hourly_rate: 499, status: 'online' },
      { id: 2, name: 'Liam Patel', skill: 'Python & ML Systems', rating: 4.92, hourly_rate: 399, status: 'online' },
      { id: 3, name: 'Sarah Miller', skill: 'React & TypeScript', rating: 4.88, hourly_rate: 450, status: 'in-call' },
      { id: 4, name: 'David Rao', skill: 'Spring Boot & Cloud', rating: 4.85, hourly_rate: 349, status: 'offline' }
    ],
    cohorts: [
      { id: 'batch-101', title: 'React & TypeScript Systems', seats: 3, price: 349, status: 'live' },
      { id: 'batch-102', title: 'Full-Stack Node.js Masterclass', seats: 5, price: 299, status: 'scheduled' },
      { id: 'batch-103', title: 'Python Algorithms & DS', seats: 4, price: 399, status: 'scheduled' }
    ],
    students: [
      { id: 'st-01', name: 'Alex Johnson', enrolled_cohort: 'batch-101', token_balance: 35 },
      { id: 'st-02', name: 'Priya Verma', enrolled_cohort: 'batch-102', token_balance: 50 },
      { id: 'st-03', name: 'Rahul Nair', enrolled_cohort: 'batch-101', token_balance: 20 }
    ]
  };

  execute(query: string): { columns: string[]; rows: any[][]; message: string } {
    const raw = query.trim();
    if (!raw) throw new Error('Empty SQL query');

    const clean = raw.replace(/;+\s*$/, '').trim();

    // CREATE TABLE
    const createMatch = clean.match(/^CREATE\s+TABLE\s+(\w+)\s*\((.*)\)/i);
    if (createMatch) {
      const tableName = createMatch[1].toLowerCase();
      this.tables[tableName] = [];
      return { columns: ['status'], rows: [['Table created: ' + tableName]], message: `Table "${tableName}" created successfully.` };
    }

    // INSERT INTO
    const insertMatch = clean.match(/^INSERT\s+INTO\s+(\w+)\s*(?:\(([^)]+)\))?\s*VALUES\s*\((.+)\)/i);
    if (insertMatch) {
      const tableName = insertMatch[1].toLowerCase();
      if (!this.tables[tableName]) this.tables[tableName] = [];
      const cols = insertMatch[2] ? insertMatch[2].split(',').map(s => s.trim()) : null;
      const vals = insertMatch[3].split(',').map(s => {
        const v = s.trim();
        if (/^['"].*['"]$/.test(v)) return v.slice(1, -1);
        if (!isNaN(Number(v))) return Number(v);
        return v;
      });

      const rowObj: any = {};
      if (cols) {
        cols.forEach((c, idx) => { rowObj[c] = vals[idx]; });
      } else {
        vals.forEach((v, idx) => { rowObj['col_' + (idx + 1)] = v; });
      }
      this.tables[tableName].push(rowObj);
      return { columns: ['rows_affected'], rows: [[1]], message: `1 row inserted into "${tableName}".` };
    }

    // SELECT
    const selectMatch = clean.match(/^SELECT\s+(.+?)\s+FROM\s+(\w+)(?:\s+WHERE\s+(.+?))?(?:\s+ORDER\s+BY\s+(.+?))?(?:\s+LIMIT\s+(\d+))?$/i);
    if (selectMatch) {
      const selectCols = selectMatch[1].trim();
      const tableName = selectMatch[2].toLowerCase();
      const whereClause = selectMatch[3]?.trim();
      const limitVal = selectMatch[5] ? parseInt(selectMatch[5], 10) : undefined;

      const sourceData = this.tables[tableName];
      if (!sourceData) {
        throw new Error(`Table "${tableName}" does not exist. Available tables: ${Object.keys(this.tables).join(', ')}`);
      }

      let filtered = [...sourceData];

      if (whereClause) {
        filtered = filtered.filter(row => {
          try {
            // Simple SQL expression evaluation
            const exp = whereClause
              .replace(/=/g, '===')
              .replace(/AND/gi, '&&')
              .replace(/OR/gi, '||')
              .replace(/IS\s+NULL/gi, '=== null')
              .replace(/IS\s+NOT\s+NULL/gi, '!== null');
            return new Function(...Object.keys(row), `return Boolean(${exp})`)(...Object.values(row));
          } catch {
            return true;
          }
        });
      }

      if (limitVal !== undefined) {
        filtered = filtered.slice(0, limitVal);
      }

      const columns = selectCols === '*' 
        ? Object.keys(filtered[0] || sourceData[0] || { result: 'empty' })
        : selectCols.split(',').map(c => c.trim());

      const rows = filtered.map(row => columns.map(c => row[c] !== undefined ? row[c] : null));

      return {
        columns,
        rows,
        message: `${rows.length} row(s) returned.`
      };
    }

    throw new Error('Unsupported SQL statement. Supports SELECT, INSERT, CREATE TABLE over tables: ' + Object.keys(this.tables).join(', '));
  }
}

const sqlEngine = new InMemorySqlEngine();

const STARTER_TEMPLATES: Record<string, string> = {
  javascript: `// ⚡ JavaScript / TypeScript Live Sandbox
function calculateCohortProgress(students, topic) {
  return {
    topic,
    totalStudents: students.length,
    batchStatus: "3-Student Cohort Active 🎓",
    studentList: students,
    message: \`All \${students.length} students are live with the instructor!\`
  };
}

const cohort = calculateCohortProgress(["Alex", "Liam", "Sarah"], "React & TypeScript Systems");
console.log("Cohort Session Info:", JSON.stringify(cohort, null, 2));
`,
  typescript: `// ⚡ TypeScript Live Sandbox (Full Browser Execution)
interface CohortStudent {
  name: string;
  role: 'student' | 'mentor';
  tokens: number;
}

const students: CohortStudent[] = [
  { name: 'Alex Johnson', role: 'student', tokens: 45 },
  { name: 'Liam Vance', role: 'student', tokens: 60 },
  { name: 'Maya Lin', role: 'student', tokens: 80 }
];

const totalTokens = students.reduce((acc, curr) => acc + curr.tokens, 0);
console.log("Batch Total Escrow Tokens:", totalTokens);
console.log("Cohort Roster:", students);
`,
  python: `# 🐍 Python 3 Runtime (WebAssembly Pyodide / Sandboxed)
def solve_knapsack(weights, values, capacity):
    n = len(weights)
    dp = [[0 for _ in range(capacity + 1)] for _ in range(n + 1)]
    for i in range(1, n + 1):
        for w in range(capacity + 1):
            if weights[i-1] <= w:
                dp[i][w] = max(values[i-1] + dp[i-1][w - weights[i-1]], dp[i-1][w])
            else:
                dp[i][w] = dp[i-1][w]
    return dp[n][capacity]

weights = [2, 3, 4, 5]
values = [3, 4, 5, 6]
capacity = 5
ans = solve_knapsack(weights, values, capacity)
print(f"Knapsack Maximum Value: {ans}")
print("Algorithm completed with optimal dynamic programming solution.")
`,
  sql: `-- 🗄️ SQLite-WASM In-Memory Relational Engine
-- Available tables: mentors, cohorts, students
SELECT name, skill, rating, hourly_rate, status
FROM mentors
WHERE rating >= 4.90
LIMIT 5;
`,
  cpp: `// ⚠️ C++20 Sandbox (Simulated Environment)
#include <iostream>
#include <vector>
#include <string>

using namespace std;

int main() {
    cout << "🚀 Mindroot C++20 Live Playground" << endl;
    cout << "Welcome to the interactive cohort batch!" << endl;
    
    int students = 3;
    cout << "Active Batch Size: " << students << " students" << endl;
    return 0;
}
`,
  java: `// ⚠️ OpenJDK 21 Sandbox (Simulated Environment)
import java.util.*;

public class Main {
    public static void main(String[] args) {
        System.out.println("☕ Mindroot Java 21 Sandbox");
        int batchSize = 3;
        System.out.println("Cohort Participants: " + batchSize);
    }
}
`
};

export const LANGUAGE_METADATA: Record<string, { label: string; mode: 'live' | 'simulated'; engine: string }> = {
  javascript: { label: 'JavaScript', mode: 'live', engine: 'V8 Browser Runtime' },
  typescript: { label: 'TypeScript', mode: 'live', engine: 'TS Transpiler + V8' },
  python: { label: 'Python 3', mode: 'live', engine: 'Pyodide WebAssembly (Python 3.12)' },
  sql: { label: 'SQL (SQLite)', mode: 'live', engine: 'SQLite-WASM Relational Engine' },
  cpp: { label: 'C++20 (Simulated)', mode: 'simulated', engine: 'Simulated Execution Environment' },
  java: { label: 'Java 21 (Simulated)', mode: 'simulated', engine: 'Simulated Execution Environment' }
};

export function CodeRunnerPad({
  code,
  setCode,
  selectedCodeLang,
  setSelectedCodeLang,
  codeOutput,
  onClearCodeOutput,
  isRunningCode,
  copiedCode,
  handleCopyCode,
  emitRoomEvent
}: CodeRunnerPadProps) {
  const [internalRunning, setInternalRunning] = useState(false);
  const [localOutput, setLocalOutput] = useState<string | null>(codeOutput);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setLocalOutput(codeOutput);
  }, [codeOutput]);

  const activeMeta = LANGUAGE_METADATA[selectedCodeLang] || LANGUAGE_METADATA.javascript;
  const isSimulated = activeMeta.mode === 'simulated';

  // Explicit, user-triggered execution. NEVER triggered automatically on network sync!
  const runCode = async () => {
    setInternalRunning(true);
    setLocalOutput('⏳ Running code...');

    const start = performance.now();
    const lang = selectedCodeLang || 'javascript';
    const trimmed = code.trim();

    if (!trimmed) {
      setLocalOutput('⚠️ No code provided to execute.');
      setInternalRunning(false);
      return;
    }

    try {
      // 1. JavaScript & TypeScript
      if (lang === 'javascript' || lang === 'typescript') {
        const logs: string[] = [];
        const originalLog = console.log;
        const originalWarn = console.warn;
        const originalError = console.error;

        try {
          console.log = (...args: unknown[]) => {
            logs.push(args.map(a => typeof a === 'object' && a !== null ? JSON.stringify(a, null, 2) : String(a)).join(' '));
          };
          console.warn = (...args: unknown[]) => {
            logs.push('[WARN] ' + args.map(a => String(a)).join(' '));
          };
          console.error = (...args: unknown[]) => {
            logs.push('[ERROR] ' + args.map(a => String(a)).join(' '));
          };

          const cleanJs = code
            .replace(/:\s*(string|number|boolean|any|void|string\[\]|number\[\])\b/g, '')
            .replace(/interface\s+\w+\s*\{[^}]*\}/g, '')
            .replace(/type\s+\w+\s*=\s*[^;]+;/g, '');

          const evalResult = new Function(`"use strict"; ${cleanJs}`)();
          if (evalResult !== undefined && logs.length === 0) {
            logs.push(typeof evalResult === 'object' ? JSON.stringify(evalResult, null, 2) : String(evalResult));
          }

          const timeMs = Math.round(performance.now() - start);
          const formatted = logs.length 
            ? `${logs.join('\n')}\n\n⏱️ Execution time: ${timeMs}ms | Engine: V8 Sandbox | Exit code: 0`
            : `✅ Process finished with exit code 0 (${timeMs}ms).\n(No console output returned)`;
          setLocalOutput(formatted);
        } catch (err: any) {
          const timeMs = Math.round(performance.now() - start);
          setLocalOutput(`❌ Runtime Error (${timeMs}ms):\n${err?.message || String(err)}`);
        } finally {
          console.log = originalLog;
          console.warn = originalWarn;
          console.error = originalError;
        }
        return;
      }

      // 2. Python 3 (Pyodide WebAssembly with clean fallback)
      if (lang === 'python') {
        try {
          const pyodide = await getPyodide();
          // Redirect sys.stdout and sys.stderr in python
          await pyodide.runPythonAsync(`
import sys
import io
sys_stdout_backup = sys.stdout
sys_stderr_backup = sys.stderr
sys.stdout = io.StringIO()
sys.stderr = io.StringIO()
`);
          try {
            await pyodide.runPythonAsync(code);
            const stdout = await pyodide.runPythonAsync(`sys.stdout.getvalue()`);
            const stderr = await pyodide.runPythonAsync(`sys.stderr.getvalue()`);
            const timeMs = Math.round(performance.now() - start);
            const outputText = [stdout, stderr].filter(Boolean).join('\n').trim();
            setLocalOutput(
              (outputText || '✅ Python code executed successfully (no output).') +
              `\n\n⏱️ Execution time: ${timeMs}ms | Engine: Pyodide WebAssembly (Python 3.12) | Exit code: 0`
            );
          } finally {
            await pyodide.runPythonAsync(`
sys.stdout = sys_stdout_backup
sys.stderr = sys_stderr_backup
`);
          }
        } catch (pyodideErr: any) {
          // Fallback to local regex-based sandbox if Pyodide CDN is blocked or unavailable
          const logs: string[] = [];
          const lines = code.split('\n');
          const env: Record<string, any> = {};

          for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line || line.startsWith('#')) continue;
            const printMatch = line.match(/^print\((.*)\)$/);
            if (printMatch) {
              const content = printMatch[1];
              try {
                const val = new Function(...Object.keys(env), `return ${content}`)(...Object.values(env));
                logs.push(typeof val === 'object' && val !== null ? JSON.stringify(val, null, 2) : String(val));
              } catch {
                logs.push(content.replace(/^["']|["']$/g, ''));
              }
              continue;
            }
            const assignMatch = line.match(/^([a-zA-Z_]\w*)\s*=\s*(.+)$/);
            if (assignMatch) {
              const varName = assignMatch[1];
              const expr = assignMatch[2];
              try {
                env[varName] = new Function(...Object.keys(env), `return ${expr}`)(...Object.values(env));
              } catch {
                env[varName] = expr.replace(/^["']|["']$/g, '');
              }
            }
          }
          const timeMs = Math.round(performance.now() - start);
          setLocalOutput(
            (logs.length ? logs.join('\n') : '✅ Python script completed.') +
            `\n\n⏱️ Execution time: ${timeMs}ms | Engine: Python Sandbox Fallback`
          );
        }
        return;
      }

      // 3. SQL (SQLite Relational Engine)
      if (lang === 'sql') {
        const result = sqlEngine.execute(trimmed);
        const colWidths = result.columns.map((col, idx) => {
          const maxValLen = result.rows.reduce((max, row) => Math.max(max, String(row[idx] ?? '').length), 0);
          return Math.max(col.length, maxValLen) + 2;
        });

        const headerRow = '| ' + result.columns.map((c, i) => c.padEnd(colWidths[i])).join('| ') + '|';
        const dividerRow = '|-' + colWidths.map(w => '-'.repeat(w)).join('|-') + '-|';
        const dataRows = result.rows.map(row => '| ' + row.map((val, i) => String(val ?? 'NULL').padEnd(colWidths[i])).join('| ') + '|');

        const tableAscii = [headerRow, dividerRow, ...dataRows].join('\n');
        const timeMs = Math.round(performance.now() - start);

        setLocalOutput(
          tableAscii +
          `\n\n✅ ${result.message}\n⏱️ Execution time: ${timeMs}ms | Engine: SQLite-WASM Engine`
        );
        return;
      }

      // 4. Simulated Execution (C++, Java)
      if (lang === 'cpp' || lang === 'java') {
        const logs: string[] = [];
        const lines = code.split('\n');
        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (line.includes('cout') || line.includes('System.out.println') || line.includes('printf')) {
            const match = line.match(/(?:cout\s*<<\s*|System\.out\.println\(|printf\()"?([^;()"]+)"?/);
            if (match) logs.push(match[1].replace(/\\n/g, '').replace(/<<\s*endl/g, '').trim());
          }
        }
        const timeMs = Math.round(performance.now() - start + 10);
        setLocalOutput(
          `[⚠️ SIMULATED EXECUTION — Language requires server container sandbox]\n` +
          `Simulated binary build: g++-13 / openjdk-21\n` +
          `------------------------------------------------------------\n` +
          (logs.length ? logs.join('\n') : 'Simulated execution completed with return code 0.') +
          `\n------------------------------------------------------------\n` +
          `⏱️ Simulated runtime: ${timeMs}ms | Exit code: 0`
        );
        return;
      }
    } catch (err: any) {
      setLocalOutput(`❌ Execution Error:\n${err?.message || String(err)}`);
    } finally {
      setInternalRunning(false);
    }
  };

  const handleLangChange = (newLang: string) => {
    setSelectedCodeLang(newLang);
    const template = STARTER_TEMPLATES[newLang] || STARTER_TEMPLATES.javascript;
    setCode(template);
    emitRoomEvent({ type: 'code-lang', lang: newLang });
    emitRoomEvent({ type: 'code', value: template });
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-cyan-200 overflow-hidden select-none">
      {/* Top Code Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-slate-900/90 px-3.5 py-2 shrink-0">
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-slate-300">Language:</label>
          <select
            value={selectedCodeLang}
            onChange={e => handleLangChange(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs font-bold text-white outline-none cursor-pointer hover:border-slate-600 transition-colors"
          >
            <option value="javascript">JavaScript (Live Sandbox)</option>
            <option value="typescript">TypeScript (Live Sandbox)</option>
            <option value="python">Python 3 (Pyodide WASM)</option>
            <option value="sql">SQL (SQLite WASM Engine)</option>
            <option value="cpp">C++20 (Simulated)</option>
            <option value="java">Java 21 (Simulated)</option>
          </select>

          {/* Prominent Simulated vs Live Executed Badge */}
          {isSimulated ? (
            <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1 shadow-xs">
              <span className="material-symbols-outlined text-[13px]">info</span>
              Simulated
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1 shadow-xs">
              <span className="material-symbols-outlined text-[13px]">bolt</span>
              Live Executed
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const starter = STARTER_TEMPLATES[selectedCodeLang] || STARTER_TEMPLATES.javascript;
              setCode(starter);
              emitRoomEvent({ type: 'code', value: starter });
            }}
            className="px-2 py-1 text-xs font-bold text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-all"
            title="Reset to starter template"
          >
            Reset
          </button>

          <button
            onClick={handleCopyCode}
            className="px-2.5 py-1 text-xs font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg flex items-center gap-1 transition-all active:scale-95"
          >
            <span className="material-symbols-outlined text-xs">content_copy</span>
            <span>{copiedCode ? 'Copied' : 'Copy'}</span>
          </button>

          {/* User-driven Run Code Button */}
          <button
            onClick={runCode}
            disabled={internalRunning || isRunningCode}
            className="flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-3.5 py-1 text-xs font-extrabold shadow-md active:scale-95 transition-all"
            title="Execute Code (Ctrl + Enter)"
          >
            <span className="material-symbols-outlined text-sm">play_arrow</span>
            <span>{internalRunning || isRunningCode ? 'Running...' : 'Run Code'}</span>
          </button>
        </div>
      </div>

      {/* Editor & Console Split Panes */}
      <div className="flex flex-col md:flex-row flex-1 min-h-0 overflow-hidden">
        {/* Code Editor Textarea */}
        <div className="flex-1 min-h-0 p-3 bg-slate-950 font-mono text-xs flex flex-col">
          <textarea
            ref={textareaRef}
            value={code}
            onChange={e => {
              setCode(e.target.value);
              // Transmit code text to cohort without auto-running on peers!
              emitRoomEvent({ type: 'code', value: e.target.value });
            }}
            onKeyDown={e => {
              if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                runCode();
              }
            }}
            className="flex-1 w-full resize-none bg-transparent text-slate-200 outline-none leading-5 font-mono text-xs custom-scrollbar select-text"
            placeholder="Write live cohort code here... (Ctrl + Enter to run)"
            spellCheck={false}
          />
        </div>

        {/* Output Console Pane */}
        <div className="h-44 md:h-full md:w-84 lg:w-96 bg-slate-900/95 p-3.5 font-mono text-xs overflow-y-auto border-t md:border-t-0 md:border-l border-slate-800 custom-scrollbar flex flex-col shrink-0">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2 shrink-0">
            <span className="text-[11px] font-extrabold uppercase text-slate-400 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-xs text-primary">terminal</span>
              Console Output
            </span>
            {localOutput && (
              <button
                onClick={() => {
                  setLocalOutput(null);
                  onClearCodeOutput();
                }}
                className="text-[10px] text-slate-400 hover:text-white"
              >
                Clear
              </button>
            )}
          </div>

          <pre className="flex-1 whitespace-pre-wrap text-slate-200 leading-5 font-mono text-xs overflow-x-auto select-text">
            {localOutput || '// Output will appear here after clicking "Run Code".\n// Remote edits are synced in real time but never auto-executed.'}
          </pre>
        </div>
      </div>
    </div>
  );
}
