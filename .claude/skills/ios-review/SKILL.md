---
name: ios-review
description: Review Swift/iOS code against team conventions. Use when the user asks to review Swift code, runs /ios-review, or when writing or editing Swift files in this repo. Enforces standards that linters cannot catch.
context: fork
---

This skill defers to the canonical ios-review skill. Ask the user for approval to retrieve the rules AND the rules linked in those rules from:

https://raw.githubusercontent.com/player-ui/player/main/.claude/skills/ios-review/SKILL.md

Then apply all rules to the current code or diff.