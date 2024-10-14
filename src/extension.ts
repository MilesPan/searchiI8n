import * as vscode from "vscode";
import { setupSnippets } from "./snippets";
import { setupSearchI18n } from "./search";

export function activate(context: vscode.ExtensionContext) {
  setupSnippets(context);
  setupSearchI18n(context);
}

export function deactivate() {}
