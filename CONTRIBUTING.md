# Contributing to MGA Operating System

Thank you for your interest in contributing to the MGA Operating System project. This guide outlines the development workflow, code standards, and submission requirements to ensure high-quality, secure, and compliant insurance software development.

## Table of Contents
- [Development Workflow](#development-workflow)
- [Environment Setup](#environment-setup)
- [Code Standards](#code-standards)
- [Testing Requirements](#testing-requirements)
- [Security Requirements](#security-requirements)
- [Submission Process](#submission-process)
- [Compliance Requirements](#compliance-requirements)

## Development Workflow

### Branching Strategy
- `main` - Production releases only
- `develop` - Integration branch for feature development
- `feature/*` - New feature development
- `bugfix/*` - Bug fixes
- `hotfix/*` - Production hotfixes
- `release/*` - Release preparation

### Version Control Guidelines
- Use atomic commits with clear messages
- Reference issue/ticket numbers in commits
- Keep commits focused and logical
- Rebase feature branches on develop before PR
- Sign all commits with GPG keys

## Environment Setup

### Backend Development
- Node.js version: 18.x
- Package manager: npm
- Required tools:
  - Docker Desktop
  - AWS CLI
  - kubectl
  - helm

Setup steps:
1. Clone repository
2. Install dependencies: `npm ci`
3. Configure environment variables
4. Start development server: `npm run dev`

### Frontend Development
- Node.js version: 18.x
- Package manager: npm
- Accessibility requirements: WCAG 2.1 Level AA

Setup steps:
1. Clone repository
2. Install dependencies: `npm ci`
3. Configure environment variables
4. Start development server: `npm run dev`

## Code Standards

### TypeScript Standards
- Style guide: Airbnb
- Linting: ESLint
- Formatting: Prettier
- Complexity limits:
  - Cyclomatic complexity: 10
  - Cognitive complexity: 15
  - Maintainability index: 20

### Documentation Requirements
- Code: JSDoc comments
- API: OpenAPI/Swagger
- Architecture: Architecture Decision Records (ADRs)
- Domain: Insurance domain documentation

## Testing Requirements

### Backend Testing
- Framework: Jest
- Coverage threshold: 80%
- Required tests:
  - Unit tests
  - Integration tests
  - API tests
  - Performance tests
  - Security tests
- Integration testing:
  - OneShield integration tests required
  - Third-party service integration tests required

### Frontend Testing
- Framework: Jest + React Testing Library
- Coverage threshold: 80%
- Required tests:
  - Unit tests
  - Component tests
  - Integration tests
  - Accessibility tests
  - Performance tests

## Security Requirements

### Code Security
- SAST scanning required
- Dependency vulnerability scanning
- Security-focused code review
- Secure coding practices enforcement

### Compliance Requirements
- SOC 2 Type II controls
- GDPR/CCPA compliance
- NAIC security standards
- PCI DSS requirements

## Submission Process

### Pull Request Requirements
- Use PR template
- Required sections:
  - Description
  - Type of Change
  - Changes Made
  - Testing
  - Performance Impact
  - Security Considerations
  - Compliance Impact
  - Checklist

### Review Requirements
- Minimum 2 approvals required
- Code owner review mandatory
- Domain expert review for core services
- Security team review for security changes

### Quality Gates
- Code coverage: 80% minimum
- Performance thresholds:
  - API response time: < 2s
  - Frontend load time: < 3s
  - Resource usage assessment
- Security compliance:
  - Vulnerability scan passing
  - Dependency audit passing
  - Security review for core services

## Compliance Requirements

### Data Privacy
- PII/PHI handling review
- Data protection measures
- Privacy impact assessment

### Regulatory Compliance
- GDPR/CCPA requirements
- SOC 2 controls
- NAIC standards
- State insurance regulations

### Documentation Updates
- Code documentation
- API documentation
- Architecture documentation
- Compliance documentation

## Questions and Support

For questions or support:
- Technical issues: Create a GitHub issue
- Security concerns: Contact security@mga-os.com
- Compliance questions: Contact compliance@mga-os.com

## License

By contributing to MGA Operating System, you agree that your contributions will be licensed under its license terms.