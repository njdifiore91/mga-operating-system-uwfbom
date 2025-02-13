# MGA Operating System Backend Service

Enterprise-grade backend service for the MGA Operating System platform providing policy administration, automated underwriting, and carrier integration capabilities.

## Architecture Overview

The MGA Operating System backend is built on a microservices architecture using:

- Java 17 (Spring Boot 3.1.x) for core business services
- Python 3.11 (FastAPI 0.100.x) for ML/underwriting services
- Node.js 18+ for API gateway and auxiliary services
- Event-driven processing with Apache Kafka 3.4
- Service mesh implementation with Istio

## Prerequisites

### Required Software
- Java 17 LTS
- Python 3.11+
- Node.js 18+
- Docker 24.0.x
- Kubernetes 1.27+
- AWS CLI 2.0+

### Infrastructure Components
- PostgreSQL 14+
- Redis 7.0+
- MongoDB 6.0+
- Apache Kafka 3.4+
- Zookeeper 3.8+

## Quick Start

1. Clone the repository and install dependencies:
```bash
git clone <repository-url>
cd mga-os/backend
npm install
```

2. Configure environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. Start development environment:
```bash
docker-compose up -d
```

4. Run database migrations:
```bash
npm run migrate
```

5. Start the development server:
```bash
npm run dev
```

## Development Environment

### Available Scripts

```json
{
  "start": "Production server",
  "dev": "Development with hot-reload",
  "build": "Build production artifacts",
  "test": "Run test suite",
  "test:coverage": "Run tests with coverage",
  "lint": "Lint codebase",
  "docker:build": "Build Docker image",
  "security:audit": "Run security checks"
}
```

### Docker Services

The development environment includes:
- API service (Node.js)
- PostgreSQL 14
- Redis 7.0
- MongoDB 6.0
- Kafka & Zookeeper
- Monitoring stack

## Security Configuration

### Authentication
- OAuth 2.0 + OIDC with Okta
- JWT tokens with 1-hour expiry
- MFA enforcement for all users
- Mutual TLS for service communication

### Authorization
- Role-Based Access Control (RBAC)
- Custom claims for fine-grained permissions
- Resource-level access control
- API key management for external services

### Data Protection
- AES-256-GCM encryption at rest
- TLS 1.3 for data in transit
- AWS KMS for key management
- Automated key rotation

## Infrastructure Setup

### AWS Services
- EKS for container orchestration
- RDS for PostgreSQL databases
- ElastiCache for Redis
- MSK for managed Kafka
- CloudWatch for monitoring

### Container Platform
- Docker for containerization
- Kubernetes for orchestration
- Istio service mesh
- Helm for package management

### Monitoring & Observability
- Prometheus for metrics
- Grafana for visualization
- ELK Stack for logging
- Jaeger for tracing

## API Documentation

API documentation is available at:
- Development: http://localhost:3000/api/docs
- Staging: https://staging-api.mga-os.com/api/docs
- Production: https://api.mga-os.com/api/docs

## Deployment

### Production Requirements
- AWS account with appropriate IAM roles
- Kubernetes cluster (EKS)
- CI/CD pipeline (Jenkins)
- Monitoring stack
- SSL certificates

### Deployment Process
1. Build and test application
2. Create Docker image
3. Push to container registry
4. Deploy with Helm
5. Run migrations
6. Verify deployment

## Contributing

1. Create feature branch
2. Implement changes
3. Add tests
4. Submit pull request

## License

Proprietary - All rights reserved

## Support

For support contact:
- Email: support@mga-os.com
- Slack: #mga-os-support