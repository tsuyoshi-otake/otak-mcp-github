using System.ComponentModel;
using System.Text;
using ModelContextProtocol.Server;
using System.IO;
using System.Text.Json;

namespace OtakMcpCommander;

[McpServerToolType]
public class CommanderTools
{
    private static readonly string LogDirectory = Path.Combine(Environment.CurrentDirectory, "logs");
    private static readonly string LogFilePath = Path.Combine(LogDirectory, "mcp-commander.log");
    private static readonly object LogLock = new object();

    // 静的コンストラクタでログディレクトリを確保
    static CommanderTools()
    {
        // logsディレクトリが存在しない場合は作成
        if (!Directory.Exists(LogDirectory))
        {
            Directory.CreateDirectory(LogDirectory);
        }
    }

    // ツール実行のログを記録するプライベートメソッド
    private void LogToolExecution(string toolName, object parameters, object result)
    {
        try
        {
            var logEntry = new
            {
                Timestamp = DateTime.Now,
                Tool = toolName,
                Parameters = parameters,
                Result = result?.ToString()?.Substring(0, Math.Min(100, result?.ToString()?.Length ?? 0)) + (result?.ToString()?.Length > 100 ? "..." : "")
            };

            string logMessage = JsonSerializer.Serialize(logEntry, new JsonSerializerOptions { WriteIndented = true });
            
            lock (LogLock) // スレッドセーフにする
            {
                File.AppendAllText(LogFilePath, $"[TOOL EXECUTION] {DateTime.Now:yyyy-MM-dd HH:mm:ss}\n{logMessage}\n\n");
            }
        }
        catch (Exception ex)
        {
            // ログ記録中のエラーはサイレントに処理（ツールの実行に影響させない）
            try
            {
                lock (LogLock)
                {
                    File.AppendAllText(LogFilePath, $"[ERROR] {DateTime.Now:yyyy-MM-dd HH:mm:ss} - Failed to log tool execution: {ex.Message}\n\n");
                }
            }
            catch
            {
                // 何もしない
            }
        }
    }
    // The method name must be EXACTLY the same as the requested tool name
    [McpServerTool]
    public string GetCurrentDirectory()
    {
        string result = Environment.CurrentDirectory;
        LogToolExecution(nameof(GetCurrentDirectory), new { }, result);
        return result;
    }

    [McpServerTool]
    public string ListFiles([Description("The directory path (optional)")] string? directory = null)
    {
        try
        {
            var params_info = new { Directory = directory };
            
            var path = directory ?? Environment.CurrentDirectory;
            var files = Directory.GetFiles(path);
            var directories = Directory.GetDirectories(path);

            var output = new StringBuilder();
            output.AppendLine($"Directory: {path}");
            output.AppendLine("\nDirectories:");
            foreach (var dir in directories)
            {
                output.AppendLine($"  {Path.GetFileName(dir)}");
            }
            output.AppendLine("\nFiles:");
            foreach (var file in files)
            {
                output.AppendLine($"  {Path.GetFileName(file)}");
            }

            string result = output.ToString();
            LogToolExecution(nameof(ListFiles), params_info, result);
            return result;
        }
        catch (Exception ex)
        {
            string error = $"Failed to list files: {ex.Message}";
            LogToolExecution(nameof(ListFiles), new { Directory = directory }, $"ERROR: {error}");
            return error;
        }
    }

    [McpServerTool]
    public async Task<string> ExecuteCommand(
        [Description("The command to execute")] string command,
        [Description("The working directory (optional)")] string? workingDirectory = null)
    {
        try
        {
            var params_info = new { Command = command, WorkingDirectory = workingDirectory };
            LogToolExecution(nameof(ExecuteCommand), params_info, $"STARTED: {command}");
            
            var startInfo = new System.Diagnostics.ProcessStartInfo
            {
                FileName = "powershell.exe",
                Arguments = $"-Command \"{command}\"",
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true
            };

            if (!string.IsNullOrEmpty(workingDirectory))
            {
                startInfo.WorkingDirectory = workingDirectory;
            }

            using var process = new System.Diagnostics.Process { StartInfo = startInfo };
            process.Start();

            var output = await process.StandardOutput.ReadToEndAsync();
            var error = await process.StandardError.ReadToEndAsync();
            await process.WaitForExitAsync();

            string result;
            if (process.ExitCode != 0)
            {
                result = $"Error (ExitCode: {process.ExitCode}): {error}";
                LogToolExecution(nameof(ExecuteCommand), params_info, $"COMPLETED WITH ERROR: {result}");
            }
            else
            {
                result = output;
                LogToolExecution(nameof(ExecuteCommand), params_info, $"COMPLETED SUCCESSFULLY: ExitCode={process.ExitCode}");
            }

            return result;
        }
        catch (Exception ex)
        {
            string error = $"Failed to execute command: {ex.Message}";
            LogToolExecution(nameof(ExecuteCommand), new { Command = command, WorkingDirectory = workingDirectory }, $"EXCEPTION: {error}");
            return error;
        }
    }

    [McpServerTool]
    public async Task<string> ReadFiles(
        [Description("The path of the file to read")] string path)
    {
        try
        {
            var params_info = new { Path = path };
            
            if (!File.Exists(path))
            {
                string error = $"File does not exist at {path}";
                LogToolExecution(nameof(ReadFiles), params_info, $"ERROR: {error}");
                return error;
            }

            string content = await File.ReadAllTextAsync(path);
            
            string result = $"File content of {path}:\n\n{content}";
            LogToolExecution(nameof(ReadFiles), params_info, $"Read {content.Length} bytes from file");
            return result;
        }
        catch (Exception ex)
        {
            string error = $"Failed to read file: {ex.Message}";
            LogToolExecution(nameof(ReadFiles), new { Path = path }, $"EXCEPTION: {error}");
            return error;
        }
    }
}