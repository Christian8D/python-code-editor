import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Playground } from "@/components/playground";

export default function Home() {
  const initialCode = readFileSync(
    join(process.cwd(), "Python Code Editor", "main.py"),
    "utf8",
  );
  return <Playground initialCode={initialCode} />;
}
