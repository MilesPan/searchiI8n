import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

export class I18nManager {
  private i18nMap: Map<string, object> = new Map();
  private fileNames: Set<string> = new Set();
  private translationFunction: string;

  constructor() {
    this.translationFunction =
      vscode.workspace
        .getConfiguration("i18nHelper")
        .get("translationFunction") || "t";
    vscode.workspace.onDidChangeConfiguration(
      this.onConfigurationChanged,
      this
    );
  }
  private onConfigurationChanged(event: vscode.ConfigurationChangeEvent) {
    if (event.affectsConfiguration("i18nHelper.translationFunction")) {
      this.translationFunction = vscode.workspace
        .getConfiguration("i18nHelper")
        .get("translationFunction", "$t");
    }
  }
  public async loadI18nFiles(workspaceFolder: vscode.WorkspaceFolder) {
    const localePath = path.join(workspaceFolder.uri.fsPath, "src\\locale");
    const languages = ["en", "cn"];

    for (const lang of languages) {
      const langPath = path.join(localePath, lang);
      if (fs.existsSync(langPath)) {
        const files = fs.readdirSync(langPath);
        for (const file of files) {
          if (file.endsWith(".json")) {
            const filePath = path.join(langPath, file);
            const content = fs.readFileSync(filePath, "utf-8");
            const jsonContent = JSON.parse(content);
            const fileName = path.basename(file, ".json");
            this.i18nMap.set(`${lang}.${fileName}`, jsonContent);
            this.fileNames.add(fileName);
          }
        }
      }
    }
  }

  public getCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position
  ): vscode.CompletionItem[] {
    const linePrefix = document
      .lineAt(position)
      .text.substr(0, position.character);
    const items: vscode.CompletionItem[] = [];

    // 匹配 $t(' 或 $t("
    const functionRegex = new RegExp(
      `${this.translationFunction.replace("$", "\\$")}\\(['"]$`
    );
    const emptyMatch = linePrefix.match(functionRegex);
    if (emptyMatch) {
      // 提供所有文件名作为建议
      for (const fileName of this.fileNames) {
        const item = new vscode.CompletionItem(fileName);
        item.kind = vscode.CompletionItemKind.File;
        item.detail = `Localization file: ${fileName}.json`;
        items.push(item);
      }
      return items;
    }

    // 匹配 $t('文件名. 或 $t("文件名.
    const fileRegex = new RegExp(
      `${this.translationFunction.replace("$", "\\$")}\\(['"]([^'"]+)\\.`
    );
    const fileMatch = linePrefix.match(fileRegex);
    if (fileMatch) {
      const [, file] = fileMatch;
      for (const [key, content] of this.i18nMap.entries()) {
        if (key.endsWith(`.${file}`)) {
          this.addCompletionItems(items, content, "", key.split(".")[0]);
        }
      }
      return items;
    }

    return items;
  }

  private addCompletionItems(
    items: vscode.CompletionItem[],
    obj: any,
    prefix: string,
    lang: string
  ) {
    for (const [key, value] of Object.entries(obj)) {
      if (!prefix || key.startsWith(prefix)) {
        const item = new vscode.CompletionItem(key);
        item.detail = `${lang}: ${value}`;
        item.kind = vscode.CompletionItemKind.Text;
        items.push(item);
      }
    }
  }
}

export function setupSnipeets(context: vscode.ExtensionContext) {
  const i18nManager = new I18nManager();

  vscode.workspace.workspaceFolders?.forEach((folder) => {
    i18nManager.loadI18nFiles(folder);
  });

  const provider = vscode.languages.registerCompletionItemProvider(
    ["vue", "javascript", "typescript"],
    {
      provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position
      ) {
        return i18nManager.getCompletionItems(document, position);
      },
    },
    "." // 触发补全的字符
  );

  context.subscriptions.push(provider);
}
