import { buildFromFiles, loadContentFiles } from "./content/load.ts";
import { QuizApp } from "./components/QuizApp.tsx";
import { ContentError } from "./components/ContentError.tsx";

const result = buildFromFiles(loadContentFiles());

if (result.warnings.length > 0 && import.meta.env.DEV) {
  console.warn("[content]\n" + result.warnings.join("\n"));
}

export function App() {
  if (!result.graph) {
    return <ContentError errors={result.errors} />;
  }
  return <QuizApp graph={result.graph} />;
}
