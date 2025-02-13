/// <reference types="vite/client" />

// Environment variable type declarations
interface ImportMetaEnv {
  /** Base URL for API endpoints */
  VITE_API_URL: string;
  
  /** Authentication domain for identity provider */
  VITE_AUTH_DOMAIN: string;
  
  /** Current environment name */
  VITE_ENV: 'development' | 'production' | 'test';
  
  /** API version string */
  VITE_API_VERSION: string;
  
  /** OneShield integration endpoint URL */
  VITE_ONESHIELD_INTEGRATION_URL: string;
  
  /** Maximum file upload size in bytes */
  VITE_MAX_UPLOAD_SIZE: number;
  
  /** Flag to enable/disable analytics */
  VITE_ENABLE_ANALYTICS: boolean;
  
  /** Application logging level */
  VITE_LOG_LEVEL: 'debug' | 'info' | 'warn' | 'error';
}

// Vite's ImportMeta interface augmentation
interface ImportMeta {
  readonly env: ImportMetaEnv;
  readonly hot: {
    readonly data: any;
    accept: (cb?: (mod: any) => void) => void;
  };
}

// SVG imports with React component support
declare module '*.svg' {
  const content: string;
  export const ReactComponent: React.FC<React.SVGProps<SVGSVGElement>>;
  export default content;
}

// PNG image imports with metadata
declare module '*.png' {
  const content: string;
  export const width: number;
  export const height: number;
  export default content;
}

// JPG image imports with metadata
declare module '*.jpg' {
  const content: string;
  export const width: number;
  export const height: number;
  export default content;
}

// CSS module imports
declare module '*.css' {
  const classes: Record<string, string>;
  export default classes;
}

// Scoped CSS module imports
declare module '*.module.css' {
  const classes: Record<string, string>;
  export default classes;
}