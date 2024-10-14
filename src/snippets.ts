import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

export class I18nManager {
  // 存储国际化文件内容的 Map
  private i18nMap: Map<string, object> = new Map();
  // 存储所有国际化文件名的prefix，用于代码提示
  private fileNames: Set<string> = new Set();
  // 自定义选项: 翻译函数名
  private translationFunction: string;

  constructor() {
    // 获取配置项中配置的翻译函数名
    this.translationFunction =
      vscode.workspace
        .getConfiguration("i18nHelper")
        .get("translationFunction") || "t";
    // 监听配置变化
    vscode.workspace.onDidChangeConfiguration(
      this.onConfigurationChanged,
      this
    );
  }
  private onConfigurationChanged(event: vscode.ConfigurationChangeEvent) {
    // 如果翻译函数配置发生变化，更新 translationFunction
    if (event.affectsConfiguration("i18nHelper.translationFunction")) {
      this.translationFunction = vscode.workspace
        .getConfiguration("i18nHelper")
        .get("translationFunction", "$t");
    }
  }

  // 加载所有国际化文件
  public async loadI18nFiles(workspaceFolder: vscode.WorkspaceFolder) {
    // TODO: 路径改为配置项
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

  // 获取代码补全
  public getCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position
  ): vscode.CompletionItem[] {
    // 当前光标所在位置的行前缀字符
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
        // 创建一个文件名补全项
        const item = new vscode.CompletionItem(fileName);
        item.kind = vscode.CompletionItemKind.File;
        item.detail = `Localization file: ${fileName}.json`;
        items.push(item);
      }
      return items;
    }

    // 匹配 $t('xxx. 或 $t("xxx.
    const fileRegex = new RegExp(
      `${this.translationFunction.replace("$", "\\$")}\\(['"]([^'"]+)\\.`
    );
    const fileMatch = linePrefix.match(fileRegex);
    if (fileMatch) {
      const [, file] = fileMatch;
      for (const [key, content] of this.i18nMap.entries()) {
        if (key.endsWith(`.${file}`)) {
          // 提供xxx文件下所有key为补全项
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

export function setupSnippets(context: vscode.ExtensionContext) {
  const i18nManager = new I18nManager();

  vscode.workspace.workspaceFolders?.forEach((folder) => {
    i18nManager.loadI18nFiles(folder);
  });

  // 注册补全提供程序
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
