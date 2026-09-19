import { Component } from "solid-js";
import katex from "katex";
import "katex/dist/katex.min.css";

export interface MathTexProps {
  math: string;
  block?: boolean;
  class?: string;
}

const katexCache = new Map<string, string>();

function getKatexHtml(math: string, block: boolean): string {
  const key = `${block ? "B:" : "I:"}${math}`;
  const hit = katexCache.get(key);
  if (hit !== undefined) return hit;
  try {
    const rendered = katex.renderToString(math, {
      throwOnError: false,
      displayMode: block,
    });
    katexCache.set(key, rendered);
    return rendered;
  } catch {
    return math;
  }
}

export const MathTex: Component<MathTexProps> = (props) => {
  const html = () => getKatexHtml(props.math, props.block ?? false);

  return <span class={`inline-block align-middle ${props.class ?? ""}`} innerHTML={html()} />;
};

export default MathTex;
