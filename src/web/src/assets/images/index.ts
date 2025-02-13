// Image asset management for MGA OS web application
// Material Design 3.0 compliant with custom MGA OS theme tokens

// Supported image formats and dimension constraints
export const SUPPORTED_IMAGE_FORMATS = ['.png', '.jpg', '.jpeg', '.svg', '.webp'] as const;

export const IMAGE_DIMENSIONS = {
  logo: { width: 180, height: 45 },
  avatar: { width: 40, height: 40 },
  illustration: { width: 400, height: 300 }
} as const;

// Type-safe interface for image assets
export interface ImageAsset {
  path: string;
  alt: string;
  width: number;
  height: number;
  format: string;
  preload: boolean;
}

// Helper function to get validated image URLs
export const getImageUrl = (imageName: string, config: ImageAsset): string => {
  if (!imageName) {
    throw new Error('Image name is required');
  }

  const fileExtension = config.format.toLowerCase();
  if (!SUPPORTED_IMAGE_FORMATS.includes(fileExtension as any)) {
    throw new Error(`Unsupported image format: ${fileExtension}`);
  }

  // Validate dimensions against constraints
  const assetType = imageName.includes('logo') ? 'logo' : 
                    imageName.includes('avatar') ? 'avatar' : 'illustration';
  
  const constraints = IMAGE_DIMENSIONS[assetType];
  if (config.width !== constraints.width || config.height !== constraints.height) {
    throw new Error(`Invalid dimensions for ${assetType}. Expected ${constraints.width}x${constraints.height}`);
  }

  // Use CDN URL in production, local path in development
  const baseUrl = process.env.NODE_ENV === 'production' 
    ? process.env.REACT_APP_CDN_URL 
    : '';
  
  return `${baseUrl}/assets/images/${imageName}${fileExtension}`;
};

// Preload critical images for performance
export const preloadCriticalImages = (images: ImageAsset[]): void => {
  const criticalImages = images.filter(img => img.preload);
  
  criticalImages.forEach(img => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = getImageUrl(img.path, img);
    
    link.onerror = () => {
      console.error(`Failed to preload image: ${img.path}`);
    };
    
    document.head.appendChild(link);
  });
};

// Brand Assets
export const logoLight: ImageAsset = {
  path: 'mga-os-logo-light',
  alt: 'MGA OS Logo - Light Theme',
  width: IMAGE_DIMENSIONS.logo.width,
  height: IMAGE_DIMENSIONS.logo.height,
  format: '.svg',
  preload: true
};

export const logoDark: ImageAsset = {
  path: 'mga-os-logo-dark',
  alt: 'MGA OS Logo - Dark Theme',
  width: IMAGE_DIMENSIONS.logo.width,
  height: IMAGE_DIMENSIONS.logo.height,
  format: '.svg',
  preload: true
};

// UI Assets
export const defaultAvatar: ImageAsset = {
  path: 'default-avatar',
  alt: 'Default User Avatar',
  width: IMAGE_DIMENSIONS.avatar.width,
  height: IMAGE_DIMENSIONS.avatar.height,
  format: '.png',
  preload: false
};

export const loadingSpinner: ImageAsset = {
  path: 'loading-spinner',
  alt: 'Loading...',
  width: 48,
  height: 48,
  format: '.svg',
  preload: true
};

// State Illustrations
export const emptyState: ImageAsset = {
  path: 'empty-state-illustration',
  alt: 'No items to display',
  width: IMAGE_DIMENSIONS.illustration.width,
  height: IMAGE_DIMENSIONS.illustration.height,
  format: '.svg',
  preload: false
};

export const errorState: ImageAsset = {
  path: 'error-state-illustration',
  alt: 'An error occurred',
  width: IMAGE_DIMENSIONS.illustration.width,
  height: IMAGE_DIMENSIONS.illustration.height,
  format: '.svg',
  preload: false
};