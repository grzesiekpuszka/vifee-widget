/// <reference types="vite/client" />

declare module '*.scss?inline' {
  const content: string;
  export default content;
}

declare module '*.svg?raw' {
  const content: string;
  export default content;
}
