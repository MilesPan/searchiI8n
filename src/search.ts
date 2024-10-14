// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
const path = require("path");
const fs = require("fs");

const getAllFiles = (dir: any): string[] => {
  const files = fs.readdirSync(dir);
  let fileList: any = [];
  files.forEach((file: any) => {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      // 如果是文件夹，则递归遍历
      fileList = fileList.concat(getAllFiles(filePath));
    } else {
      // 如果是文件，则添加到文件列表
      fileList.push(filePath);
    }
  });
  return fileList;
};

function getActiveEditor() {
  // 当前文本编辑器
  const activeEditor = vscode.window.activeTextEditor;
  if (!activeEditor) {
    vscode.window.showInformationMessage("No active editor.");
    return;
  }
  return activeEditor;
}

async function getLocaleFolder(langFolder: "en" | "cn") {
  const activeEditor = vscode.window.activeTextEditor;
  const fileUri = activeEditor?.document.uri; // 编辑器打开的文件
  if (!fileUri) {
    vscode.window.showErrorMessage("No active file");
    return;
  }
  const rootPath = vscode.workspace.getWorkspaceFolder(fileUri);
  if (!rootPath) {
    vscode.window.showErrorMessage("No workspace folder found.");
    return;
  }

  // 翻译文件夹
  // 直接写死 反正也没人用
  const localeFolderPath = path.join(rootPath.uri.fsPath, "src/locale");
  const targetFolderPath = path.join(localeFolderPath, langFolder);
  const targetFolderPaths = getAllFiles(targetFolderPath);
  const entries = await vscode.workspace.fs.readDirectory(
    vscode.Uri.file(localeFolderPath)
  );
  const targetEntry = entries.find((entry) => entry[0] === langFolder);
  return { targetFolder: targetEntry, targetFolderPaths };
}

function getKeys(
  searchValue: string | undefined,
  folder: [string, vscode.FileType],
  folderPaths: string[]
) {
  if (!searchValue) {
    return;
  }
  const keys: string[] = [];
  for (let i = 0; i < folderPaths.length; i++) {
    const filePath = folderPaths[i];
    // ...\src\locale\en\basicSet.json => basicSet
    const fileName = filePath.split("\\").at(-1)?.split(".")[0];
    // json的文件内容，将其通过换行符号分隔就是每一行的内容
    // 用\n分割，因为LF文件中换行符是\n，CRLF文件中换行符是\r\n
    const contentRows: string[] = fs
      .readFileSync(filePath, "utf-8")
      .split("\n");
    for (let j = 0; j < contentRows.length; j++) {
      const rowStr = contentRows[j];
      const matchRes = rowStr.match(/"([^"]+)": "([^"]+)"/);
      if (matchRes && matchRes.length === 3) {
        const key = matchRes[1];
        const value = matchRes[2];
        if (value === searchValue) {
          keys.push(fileName + "." + key);
          break; //因为单个文件夹内肯定不会有重复的 可以break
        }
      }
    }
  }
  return keys;
}

export  function setupSearchI18n(context: vscode.ExtensionContext) {
  let disposable = vscode.commands.registerCommand(
    "extension.searchI18n",
    async () => {
      // 获取文件夹
      const locale = await getLocaleFolder("en");
      // 英语翻译的文件夹
      const enFolder = locale?.targetFolder;
      // 英语翻译的文件路径数组
      const enFolderPaths = locale?.targetFolderPaths;

      //查询的内容
      const searchValue = await vscode.window.showInputBox({
        prompt: "输入要查询的英文",
        placeHolder: "Search...",
        value: "", // 设置默认值
      });
      // 根据查询的内容查到的key (可能有多个)
      const searchKeys = getKeys(searchValue, enFolder!, enFolderPaths!);
      if (!searchKeys || !searchKeys.length) {
        return;
      }

      const activeEditor = getActiveEditor();
      if (!activeEditor) {
        return;
      }
      const editorContent = activeEditor?.document.getText();

      const matchRes: Array<{ start: number; end: number }> = [];
      let match;

      searchKeys.forEach((key: string) => {
        const searchRegex = new RegExp(`\\b${key}\\b`, "g");
        while ((match = searchRegex.exec(editorContent)) !== null) {
          matchRes.push({ start: match.index, end: match.index + key.length });
        }
      });
      if (matchRes.length === 0) {
        vscode.window.showInformationMessage("No matches found.");
        return;
      }
      matchRes.forEach((match) => {
        const startPosition = activeEditor.document.positionAt(match.start);
        const endPosition = activeEditor.document.positionAt(match.end);
        activeEditor.selection = new vscode.Selection(
          startPosition,
          endPosition
        );
      });
      const firstMatchPosition = activeEditor.document.positionAt(
        matchRes[0].start
      );
      activeEditor.revealRange(
        new vscode.Range(firstMatchPosition, firstMatchPosition)
      );

      // 这里执行在 Ctrl+Shift+0 快捷键触发时需要执行的操作
      // vscode.window.showInformationMessage("searchValue");
    }
  );

  context.subscriptions.push(disposable);
}
