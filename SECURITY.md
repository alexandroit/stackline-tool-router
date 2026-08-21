# Security Policy

## Supported versions

| Version | Supported |
| --- | --- |
| 1.x | Yes |
| 0.x | No public release |

## Reporting a vulnerability

Use the repository's private GitHub security advisory form:

https://github.com/alexandroit/stackline-tool-router/security/advisories/new

Include the affected version, minimal reproduction, impact, and any proposed
mitigation. Do not disclose the issue publicly before a coordinated fix is
available.

## Security boundaries

The package ranks tool definitions. It does not authenticate tool calls,
authorize actions, validate tool arguments against JSON Schema, execute tools,
or make outbound requests. Applications remain responsible for those controls.

Definitions are treated as untrusted during indexing. Dangerous prototype
keys and accessors are not traversed, internal dictionaries avoid ordinary
object prototypes, cyclic definitions are rejected, and size/depth limits are
enabled by default.

No package can promise universal freedom from vulnerabilities. Consumers
should pin reviewed versions, inspect release notes, run their own audit, and
apply application-specific security controls.
