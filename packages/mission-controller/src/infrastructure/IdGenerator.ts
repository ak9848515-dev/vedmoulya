// ID generator with prefix support
let counter = 0;
export function createIdGenerator(): { generateId(prefix: string): string } {
  return {
    generateId(prefix: string): string {
      counter += 1;
      return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}`;
    },
  };
}
