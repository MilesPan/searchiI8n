import * as vscode from "vscode";
import { setupSnipeets } from "./snipeets";
import { setupSearchI18n } from "./search";

export function activate(context: vscode.ExtensionContext) {
  setupSnipeets(context);
  setupSearchI18n(context);
}

export function deactivate() {}
