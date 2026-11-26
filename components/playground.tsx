"use client";

import { useEffect, useId, useRef, useState } from "react";
import { readProgramChoices, readPrompt } from "@/lib/program-choices";

const STDIN_CAPACITY = 64 * 1024;
const STATE_READY = 1;
const STATE_EOF = -1;

type SessionStatus =
  | "loading"
  | "running"
  | "waiting"
  | "finished"
  | "stopped"
  | "error";

interface WorkerMessage {
  type: "ready" | "stdout" | "stderr" | "stdin" | "done" | "stopped" | "error";
  text?: string;
  message?: string;
}

interface PlaygroundProps {
  initialCode: string;
}

const STATUS_LABEL: Record<SessionStatus, string> = {
  loading: "Loading Python",
  running: "Running",
  waiting: "Waiting for your answer",
  finished: "Finished",
  stopped: "Stopped",
  error: "Error",
};

function appendOutput(current: string, text: string): string {
  return current + text;
}

export function Playground({ initialCode }: PlaygroundProps) {
  const answerId = useId();
  const [code, setCode] = useState(initialCode);
  const [output, setOutput] = useState("");
  const [answer, setAnswer] = useState("");
  const [status, setStatus] = useState<SessionStatus>("loading");
  const logRef = useRef<HTMLDivElement>(null);
  const lineNumberRef = useRef<HTMLPreElement>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const answerRef = useRef<HTMLInputElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const stdinRef = useRef<SharedArrayBuffer | null>(null);
  const interruptRef = useRef<SharedArrayBuffer | null>(null);
  const statusRef = useRef<SessionStatus>("loading");
  const readyRef = useRef(false);
  const pendingCodeRef = useRef<string | null>(
    initialCode.trim().length > 0 ? initialCode : null,
  );
  const codeRef = useRef(initialCode);

  useEffect(() => {
    codeRef.current = code;
  }, [code]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    const log = logRef.current;
    if (!log) {
      return;
    }
    log.scrollTop = log.scrollHeight;
  }, [output, status]);

  useEffect(() => {
    if (status === "waiting") {
      answerRef.current?.focus();
    }
  }, [status]);

  useEffect(() => {
    if (typeof SharedArrayBuffer === "undefined" || !crossOriginIsolated) {
      statusRef.current = "error";
      queueMicrotask(() => {
        setStatus("error");
        setOutput(
          "This browser blocked the Python runner. Refresh the page. If it still fails, open the lab in Chrome, Edge, or Firefox.",
        );
      });
      return;
    }
    const stdin = new SharedArrayBuffer(8 + STDIN_CAPACITY);
    const interrupt = new SharedArrayBuffer(4);
    stdinRef.current = stdin;
    interruptRef.current = interrupt;
    const worker = new Worker("/pyodide-worker.mjs", { type: "module" });
    workerRef.current = worker;
    const startRun = (source: string) => {
      pendingCodeRef.current = null;
      statusRef.current = "running";
      setStatus("running");
      setOutput("");
      setAnswer("");
      worker.postMessage({ type: "run", code: source });
    };
    worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      const message = event.data;
      if (message.type === "ready") {
        readyRef.current = true;
        const queued = pendingCodeRef.current;
        if (queued !== null) {
          startRun(queued);
        } else {
          statusRef.current = "stopped";
          setStatus("stopped");
        }
        return;
      }
      if (message.type === "stdout" || message.type === "stderr") {
        setOutput((current) => appendOutput(current, message.text ?? ""));
        return;
      }
      if (message.type === "stdin") {
        statusRef.current = "waiting";
        setStatus("waiting");
        return;
      }
      if (message.type === "done") {
        statusRef.current = "finished";
        setStatus("finished");
      } else if (message.type === "stopped") {
        statusRef.current = "stopped";
        setStatus("stopped");
        setOutput((current) => `${current}${current.endsWith("\n") ? "" : "\n"}Program stopped.\n`);
      } else if (message.type === "error") {
        statusRef.current = "error";
        setStatus("error");
        const errorText = message.message ?? "The program stopped with an error.";
        setOutput((current) => `${current}${current.endsWith("\n") || current.length === 0 ? "" : "\n"}${errorText}\n`);
      }
      const queued = pendingCodeRef.current;
      if (
        readyRef.current &&
        queued !== null &&
        (message.type === "stopped" || message.type === "done" || message.type === "error")
      ) {
        startRun(queued);
      }
    };
    worker.onerror = () => {
      statusRef.current = "error";
      setStatus("error");
      setOutput("Python failed to load. Check your connection and refresh the page.");
    };
    worker.postMessage({ type: "init", stdin, interrupt });
    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  function writeStdin(line: string, eof = false): void {
    const stdin = stdinRef.current;
    if (!stdin) {
      return;
    }
    const state = new Int32Array(stdin, 0, 1);
    const byteLength = new Int32Array(stdin, 4, 1);
    const bytes = new Uint8Array(stdin, 8);
    if (!eof) {
      const encoded = new TextEncoder().encode(line);
      const length = Math.min(encoded.length, bytes.length);
      bytes.set(encoded.subarray(0, length));
      Atomics.store(byteLength, 0, length);
      Atomics.store(state, 0, STATE_READY);
    } else {
      Atomics.store(byteLength, 0, 0);
      Atomics.store(state, 0, STATE_EOF);
    }
    Atomics.notify(state, 0);
  }

  function requestStop(): void {
    const interrupt = interruptRef.current;
    if (interrupt) {
      new Int32Array(interrupt)[0] = 2;
    }
    writeStdin("", true);
  }

  function runCode(source: string): void {
    pendingCodeRef.current = source;
    const currentStatus = statusRef.current;
    if (currentStatus === "loading") {
      return;
    }
    if (currentStatus === "running" || currentStatus === "waiting") {
      requestStop();
      return;
    }
    const worker = workerRef.current;
    if (!worker) {
      return;
    }
    pendingCodeRef.current = null;
    statusRef.current = "running";
    setStatus("running");
    setOutput("");
    setAnswer("");
    worker.postMessage({ type: "run", code: source });
  }

  function submitAnswer(line: string): void {
    if (statusRef.current !== "waiting") {
      return;
    }
    statusRef.current = "running";
    setStatus("running");
    setOutput((current) => `${current}${line}\n`);
    setAnswer("");
    writeStdin(line);
  }

  function syncLineNumbers(scrollTop: number): void {
    if (lineNumberRef.current) {
      lineNumberRef.current.scrollTop = scrollTop;
    }
  }

  const choices = status === "waiting" ? readProgramChoices(output) : [];
  const prompt = readPrompt(output);
  const lineCount = code.split("\n").length;
  const isBusy = status === "running" || status === "waiting" || status === "loading";

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#e4d8c8] px-4 py-3 sm:px-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Python Code Editor</h1>
          <p className="mt-1 max-w-2xl text-sm text-[#57534e]">
            Write Python on the right, then press Run. Output appears on the left in your browser.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="h-11 rounded-full bg-[#9a3412] px-5 text-sm font-semibold text-white hover:bg-[#7c2d12] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9a3412] disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => runCode(codeRef.current)}
            disabled={status === "loading"}
          >
            Run
          </button>
          <button
            type="button"
            className="h-11 rounded-full border border-[#d6d3d1] bg-white px-5 text-sm font-semibold hover:bg-[#faf7f2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9a3412] disabled:cursor-not-allowed disabled:opacity-50"
            onClick={requestStop}
            disabled={status !== "running" && status !== "waiting"}
          >
            Stop
          </button>
          <button
            type="button"
            className="h-11 rounded-full border border-[#d6d3d1] bg-white px-5 text-sm font-semibold hover:bg-[#faf7f2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9a3412]"
            onClick={() => {
              setCode(initialCode);
              codeRef.current = initialCode;
              if (initialCode.trim().length > 0) {
                runCode(initialCode);
              } else {
                requestStop();
                setOutput("");
                setAnswer("");
                statusRef.current = "stopped";
                setStatus("stopped");
              }
            }}
          >
            Reset
          </button>
        </div>
      </header>
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-2">
        <section className="flex min-h-[28rem] flex-col border-b border-[#e4d8c8] lg:min-h-0 lg:border-r lg:border-b-0" aria-labelledby="output-heading">
          <div className="flex items-center justify-between gap-3 border-b border-[#e4d8c8] px-4 py-3">
            <h2 id="output-heading" className="text-sm font-semibold">
              Output
            </h2>
            <p className="text-sm text-[#57534e]" role="status">
              {STATUS_LABEL[status]}
            </p>
          </div>
          <div
            ref={logRef}
            className="min-h-0 flex-1 overflow-auto bg-[#fffdf8] px-4 py-4 font-mono text-sm leading-6 whitespace-pre-wrap"
            role="log"
            aria-label="Program output"
          >
            {output || (status === "loading" ? "Loading Python. The first run takes a few seconds." : "")}
          </div>
          <form
            className="border-t border-[#e4d8c8] bg-white px-4 py-4"
            onSubmit={(event) => {
              event.preventDefault();
              submitAnswer(answer);
            }}
          >
            <label htmlFor={answerId} className="block text-sm font-semibold">
              {status === "waiting" ? prompt : "Answer"}
            </label>
            {choices.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {choices.map((choice) => (
                  <button
                    key={`${choice.value}-${choice.label}`}
                    type="button"
                    className="h-11 rounded-full border border-[#e7e5e4] bg-[#faf7f2] px-4 text-left text-sm hover:border-[#9a3412] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9a3412]"
                    onClick={() => submitAnswer(choice.value)}
                  >
                    {choice.label}
                  </button>
                ))}
              </div>
            ) : null}
            <div className="mt-3 flex gap-2">
              <input
                ref={answerRef}
                id={answerId}
                value={answer}
                onChange={(event) => setAnswer(event.target.value)}
                disabled={status !== "waiting"}
                autoComplete="off"
                spellCheck={false}
                className="h-11 min-w-0 flex-1 rounded-xl border border-[#d6d3d1] bg-white px-3 font-mono text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9a3412] disabled:bg-[#f5f5f4]"
              />
              <button
                type="submit"
                disabled={status !== "waiting"}
                className="h-11 rounded-full bg-[#1c1917] px-5 text-sm font-semibold text-white hover:bg-[#292524] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1c1917] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Send
              </button>
            </div>
            {!isBusy ? (
              <p className="mt-2 text-sm text-[#57534e]">
                {status === "finished"
                  ? "The program finished. Press Run to start again."
                  : "Press Run to start the program again."}
              </p>
            ) : null}
          </form>
        </section>
        <section className="flex min-h-[28rem] flex-col bg-[#1c1917] text-[#f5f5f4] lg:min-h-0" aria-labelledby="code-heading">
          <div className="flex items-center justify-between gap-3 border-b border-[#44403c] px-4 py-3">
            <h2 id="code-heading" className="text-sm font-semibold">
              Python Code Editor
            </h2>
            <p className="text-sm text-[#a8a29e]">
              {code.trim().length === 0
                ? "Empty. Type or paste Python, then press Run."
                : code === initialCode
                  ? "Saved starter file"
                  : "Edited. Run uses this copy."}
            </p>
          </div>
          <div className="flex min-h-0 flex-1">
            <pre
              ref={lineNumberRef}
              aria-hidden="true"
              className="overflow-hidden py-4 pr-3 pl-4 text-right font-mono text-sm leading-6 text-[#78716c] select-none"
            >
              {Array.from({ length: lineCount }, (_, index) => index + 1).join("\n")}
            </pre>
            <label className="sr-only" htmlFor="python-source">
              Python source
            </label>
            <textarea
              ref={editorRef}
              id="python-source"
              value={code}
              spellCheck={false}
              onChange={(event) => setCode(event.target.value)}
              onScroll={(event) => syncLineNumbers(event.currentTarget.scrollTop)}
              onKeyDown={(event) => {
                if (event.key !== "Tab") {
                  return;
                }
                event.preventDefault();
                const target = event.currentTarget;
                const start = target.selectionStart;
                const end = target.selectionEnd;
                const next = `${code.slice(0, start)}  ${code.slice(end)}`;
                setCode(next);
                requestAnimationFrame(() => {
                  target.selectionStart = start + 2;
                  target.selectionEnd = start + 2;
                });
              }}
              wrap="off"
            className="min-h-0 w-full flex-1 resize-none bg-transparent py-4 pr-4 font-mono text-sm leading-6 whitespace-pre text-[#fafaf9] outline-none"
            />
          </div>
        </section>
      </div>
    </div>
  );
}
