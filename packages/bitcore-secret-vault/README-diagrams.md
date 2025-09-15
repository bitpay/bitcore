# SecureVault Architecture Diagrams

This directory contains Mermaid diagrams illustrating how the SecureVault components work together to provide secure credential storage.

## Available Diagrams

### 1. Component Architecture (`architecture-overview.md`)
Shows the overall system architecture and how components interact:
- Main process components
- Child process isolation
- Security mechanisms
- Configuration flow

### 2. Security Flow (`security-flow.md`) 
Illustrates the complete credential lifecycle:
- Initialization with secure heap
- Credential input flow
- Credential usage flow  
- Cleanup and sanitization

### 3. Process Isolation (`process-isolation.md`)
Demonstrates the multi-process security model:
- Memory space separation
- Security boundaries
- IPC communication patterns

## Key Security Features

- **Process Isolation**: Credentials stored in separate child process
- **Secure Heap**: Node.js secure heap allocation for RSA keys
- **RSA-2048 Encryption**: All credentials encrypted with strong keys
- **Buffer-Only Operations**: No string storage of sensitive data
- **Automatic Sanitization**: All buffers cleared with random data
- **IPC Validation**: All inter-process messages validated

## Usage

Each diagram is a standalone Mermaid file that can be:
- Rendered in GitHub/GitLab
- Used in documentation systems supporting Mermaid
- Exported to images using Mermaid CLI
- Embedded in other documentation

## Security Guarantees

1. Memory isolation between processes
2. Cryptographic protection of stored data
3. No string leakage of sensitive information
4. Automatic cleanup on shutdown/error
5. Validated communication channels
6. Resource limits and timeout protection
