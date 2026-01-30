# Changelog

All notable changes to Redis Tics will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-01-30

### Added
- Initial release of Redis Tics
- Multi-server management with persistent configurations
- Real-time command monitoring using Redis MONITOR
- IP address tracking and command distribution analytics
- Memory analytics with MEMORY STATS and MEMORY DOCTOR
- Command statistics showing call counts, latency, and failures
- Slow log analysis with SLOWLOG GET
- Redis Cluster support with CLUSTER INFO and CLUSTER NODES
- RDB and AOF persistence status monitoring
- CPU usage statistics
- Error statistics tracking
- LATENCY DOCTOR diagnostics
- Client list with connection details
- Beautiful dark-themed UI with charts and visualizations
- AES-256-GCM password encryption for secure storage
- Cross-platform support (macOS ARM64/Intel, Windows, Linux)
- Content Security Policy (CSP) protection
- DevTools disabled in production builds

### Security
- Passwords encrypted using AES-256-GCM with random nonces
- Encryption keys stored with restricted file permissions (0600 on Unix)
- CSP configured to prevent XSS attacks
- Prototype freezing enabled
- DevTools disabled in production

---

Made with ❤️ by [@pritamsso](https://github.com/pritamsso)
