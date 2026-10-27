export interface EditorLineLayout {
  top: number;
}

export function measureEditorLines(mirror: HTMLDivElement): EditorLineLayout[] {
  const origin = mirror.getBoundingClientRect().top;
  return Array.from(mirror.children, (line) => {
    const rect = line.getBoundingClientRect();
    return { top: rect.top - origin };
  });
}
