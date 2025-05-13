// otak-mcp-pmbok/src/types/assets.d.ts

// Declare imports for .md files as strings
declare module '*.md' {
  const content: string;
  export default content;
}

// Keep the ?raw declaration in case it's needed elsewhere,
// or remove if definitely not needed.
declare module '*?raw' {
  const content: string;
  export default content;
}