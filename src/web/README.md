# MGA OS Web Application

Enterprise-grade React application for the MGA Operating System platform, providing a modern and accessible user interface for policy administration, underwriting, and claims management.

## Project Overview

The MGA OS Web Application is a cloud-native React application built with enterprise-grade technologies and patterns:

- React 18.2.x with TypeScript 5.0 for type-safe development
- Material UI 5.14.x for consistent enterprise design system
- Redux Toolkit for predictable state management
- Real-time data synchronization via WebSocket
- WCAG 2.1 Level AA accessibility compliance
- Internationalization with RTL support
- Event-driven architecture
- Modular component design with code splitting

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- npm >= 8.0.0
- VS Code (recommended)

### Recommended VS Code Extensions

- ESLint
- Prettier
- TypeScript + JavaScript
- Jest
- Material UI Snippets
- Error Lens

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Run tests
npm run test
```

### Environment Setup

Create the following environment files:

- `.env.development` - Development environment
- `.env.staging` - Staging environment  
- `.env.production` - Production environment

Required environment variables:

```bash
VITE_API_URL=https://api.mgaos.com
VITE_WS_URL=wss://ws.mgaos.com
VITE_AUTH_DOMAIN=auth.mgaos.com
VITE_AUTH_CLIENT_ID=your_client_id
VITE_SENTRY_DSN=your_sentry_dsn
VITE_DATADOG_APP_ID=your_datadog_app_id
VITE_DATADOG_CLIENT_TOKEN=your_datadog_client_token
```

## Development

### Architecture Overview

The application follows a modular architecture with the following key patterns:

- Feature-based folder structure
- Atomic design system
- Container/Presenter pattern
- Custom hooks for reusable logic
- Error boundaries for fault isolation
- Lazy loading for performance optimization

### Code Organization

```
src/
├── assets/          # Static assets
├── components/      # Shared components
├── features/        # Feature modules
├── hooks/          # Custom React hooks
├── layouts/        # Page layouts
├── lib/            # Third-party integrations
├── routes/         # Route definitions
├── services/       # API services
├── store/          # Redux store
├── styles/         # Global styles
├── types/          # TypeScript definitions
└── utils/          # Utility functions
```

### State Management

Redux Toolkit is used for global state management with the following patterns:

- Slice-based state organization
- RTK Query for API integration
- Redux Thunk for async actions
- Reselect for memoized selectors
- Redux State Sync for tab synchronization

### Styling Guidelines

- Material UI theme customization
- CSS-in-JS with Emotion
- Responsive design with breakpoints
- Dark mode support
- RTL layout support

### Performance Optimization

- Code splitting with React.lazy()
- Route-based chunking
- Image optimization
- Memoization with useMemo/useCallback
- Virtual scrolling for large lists
- Service Worker for offline support

## Testing

### Unit Testing

```bash
# Run unit tests
npm run test

# Run tests with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

Testing stack:
- Jest for test runner
- React Testing Library for component testing
- MSW for API mocking
- jest-axe for accessibility testing

### Coverage Requirements

Minimum coverage thresholds:
- Statements: 90%
- Branches: 90%
- Functions: 90%
- Lines: 90%

### E2E Testing

Cypress is used for end-to-end testing:

```bash
# Open Cypress Test Runner
npm run cypress:open

# Run Cypress tests headless
npm run cypress:run
```

## Deployment

### Build Process

```bash
# Production build
npm run build

# Preview production build
npm run preview
```

Build output is generated in the `dist` directory.

### Docker Deployment

```dockerfile
# Build stage
FROM node:18-alpine as build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### CI/CD Pipeline

GitHub Actions workflow handles:
- Dependency installation
- Type checking
- Linting
- Unit testing
- Build verification
- Docker image creation
- Deployment to AWS

### Monitoring

- Datadog RUM for real-user monitoring
- Sentry for error tracking
- OpenTelemetry for distributed tracing
- Custom metrics via Prometheus

### Security

- OWASP Top 10 compliance
- CSP configuration
- Regular dependency updates
- Security headers
- XSS prevention
- CSRF protection

## Browser Support

Production environment supports:
- Chrome >= 90
- Firefox >= 88
- Safari >= 14
- Edge >= 90

## License

Copyright © 2023 MGA OS. All rights reserved.