# OpenAPI MCP Server Setup Guide

This package provides a universal OpenAPI MCP server that automatically loads environment variables from your `.env` file and generates tools from any OpenAPI specification.

## Quick Setup

1. **Create your `.env` file** with your API keys:
   ```bash
   cp .env.example .env
   # Edit .env with your actual API keys for the services you want to use
   ```

2. **Run the installation script**:
   ```bash
   ./install-mcp.sh
   ```

3. **Configure your services** in `services.dynamic.json`:
   - Add any OpenAPI service you want to use
   - Reference environment variables for authentication
   - Set filters to include only the endpoints you need

## How It Works

The `start-mcp-server.sh` script:
- Automatically detects and loads the `.env` file from the project directory
- Exports all environment variables so they're available to the MCP server
- Launches the OpenAPI MCP server with your services configuration
- Works universally across different shell environments and setups

## Supported Services

This setup works with any OpenAPI-compliant API. Examples included:
- GitHub API
- Docker API
- Slack API
- OpenAI API
- Stripe API
- Custom APIs with OpenAPI specs

## Security

- Environment variables are loaded at runtime, not stored in config files
- The `.env` file is automatically ignored by git
- Each user maintains their own `.env` file with their specific API keys
- No secrets are exposed in configuration files

## Troubleshooting

If tools aren't loading:
1. Check that your `.env` file exists and contains the required API keys
2. Verify the MCP server is running: check Kiro's MCP Server panel
3. Test API connectivity manually to ensure your keys are valid
4. Check that your OpenAPI specs are valid JSON/YAML
5. Verify service baseUrl matches your actual API endpoints