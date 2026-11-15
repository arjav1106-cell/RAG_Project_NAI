# Repository Guidelines

## Project Overview

This repository is an early-stage RAG project for managing Indian vehicle insurance policies and explaining policy terms. Keep documentation aligned with the implementation as it develops. For insurance answers, prefer evidence from the uploaded policy and trusted legal or regulatory sources; cite supporting passages and avoid presenting uncertain interpretations as guaranteed claim outcomes or legal advice.

## Project Structure

Currently, the repository contains `README.md` for the project scope and planned features, and this `AGENTS.md` contributor guide. Source code, tests, and assets have not been added yet. When adding them, use clear feature-oriented directories and document the resulting structure and setup in the README.

## Build, Test, and Development

No application stack or build, run, or test commands are configured yet. Do not assume a language or framework. When implementation begins, add reproducible setup and run commands to the README and provide commands for formatting, linting, and tests where the chosen stack supports them. For documentation-only changes, run `git diff --check` to catch whitespace errors.

## Style and Naming

Follow the formatter and lint rules introduced with the selected language and framework. Use descriptive names that reflect the feature or domain, and keep modules focused. Use Markdown headings and concise sections in project documentation; write commands and file paths exactly as they should be run or referenced.

## Testing Guidelines

There is no test framework or test suite yet. As features are added, include tests for core behavior, especially document extraction, retrieval relevance, answer citations, and handling of questions that the available sources cannot answer. Document the test command and naming conventions when the framework is selected.

## Commits and Pull Requests

The current history includes `docs: define vehicle insurance RAG project scope`, so use short, imperative Conventional Commit-style subjects such as `feat: add policy upload` or `docs: update setup instructions`. Pull requests should explain the user-facing change, list relevant checks, link related work when applicable, and include screenshots for interface changes.

## Security and Data Handling

Never commit real policy PDFs, personal information, API keys, credentials, or other sensitive user data. Use synthetic or redacted documents in examples and tests, and keep secrets in local environment configuration that is excluded from version control.
