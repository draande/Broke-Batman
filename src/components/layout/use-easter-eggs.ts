"use client";
import { useEffect } from "react";
const sequence = [
  "ArrowUp",
  "ArrowUp",
  "ArrowDown",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowLeft",
  "ArrowRight",
  "b",
  "a",
];
export function useEasterEggs(notify: (message: string) => void) {
  useEffect(() => {
    let position = 0;
    const listener = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        event.repeat ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        (target instanceof HTMLElement &&
          (target.isContentEditable ||
            target.closest("input, textarea, select, [role='textbox']")))
      ) {
        position = 0;
        return;
      }
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      position =
        key === sequence[position] ? position + 1 : key === sequence[0] ? 1 : 0;
      if (position === sequence.length) {
        notify("I'm Batman.");
        position = 0;
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [notify]);
}
