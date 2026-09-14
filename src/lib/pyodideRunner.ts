/**
 * freeroute In-Browser Python Runtime using Pyodide (WebAssembly)
 * 
 * Executes real Python 3 code client-side without external backend dependencies.
 */

let pyodideInstance: any = null;
let pyodideLoadingPromise: Promise<any> | null = null;

export async function getPyodideInstance(): Promise<any> {
  if (pyodideInstance) return pyodideInstance;
  if (pyodideLoadingPromise) return pyodideLoadingPromise;

  pyodideLoadingPromise = new Promise(async (resolve, reject) => {
    try {
      if (typeof window === "undefined") {
        throw new Error("Pyodide only runs in the browser environment");
      }

      // Check if pyodide script is already present in document
      if (!(window as any).loadPyodide) {
        const script = document.createElement("script");
        script.src = "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js";
        script.async = true;
        const scriptLoaded = new Promise((res, rej) => {
          script.onload = res;
          script.onerror = () => rej(new Error("Failed to load Pyodide WebAssembly runtime from CDN"));
        });
        document.head.appendChild(script);
        await scriptLoaded;
      }

      const loadPyodide = (window as any).loadPyodide;
      const pyodide = await loadPyodide({
        indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/",
      });

      pyodideInstance = pyodide;
      resolve(pyodide);
    } catch (err) {
      pyodideLoadingPromise = null;
      reject(err);
    }
  });

  return pyodideLoadingPromise;
}

export interface PyodideRunResult {
  stdout: string;
  stderr: string;
  result?: string;
  executionTimeMs: number;
}

export async function runPythonWithPyodide(code: string): Promise<PyodideRunResult> {
  const startTime = Date.now();
  const pyodide = await getPyodideInstance();

  let stdout = "";
  let stderr = "";

  pyodide.setStdout({
    batched: (msg: string) => {
      stdout += (stdout ? "\n" : "") + msg;
    },
  });

  pyodide.setStderr({
    batched: (msg: string) => {
      stderr += (stderr ? "\n" : "") + msg;
    },
  });

  try {
    const rawResult = await pyodide.runPythonAsync(code);
    const executionTimeMs = Date.now() - startTime;
    return {
      stdout,
      stderr,
      result: rawResult !== undefined ? String(rawResult) : undefined,
      executionTimeMs,
    };
  } catch (err: any) {
    const executionTimeMs = Date.now() - startTime;
    return {
      stdout,
      stderr: (stderr ? stderr + "\n" : "") + (err.message || String(err)),
      executionTimeMs,
    };
  }
}
