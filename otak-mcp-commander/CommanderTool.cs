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
                FileName = "cmd.exe",
                Arguments = $"/c {command}",
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
    public async Task<string> WriteLog(
        [Description("The log message to write")] string message)
    {
        try
        {
            var params_info = new { Message = message };
            string logEntry = $"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] {message}";
            
            await File.AppendAllTextAsync(LogFilePath, logEntry + Environment.NewLine);
            
            string result = $"Log message written: {logEntry}";
            LogToolExecution(nameof(WriteLog), params_info, result);
            return result;
        }
        catch (Exception ex)
        {
            string error = $"Failed to write log: {ex.Message}";
            LogToolExecution(nameof(WriteLog), new { Message = message }, $"ERROR: {error}");
            return error;
        }
    }

    [McpServerTool]
    public async Task<string> TailLog(
        [Description("Number of lines to read from the end (optional)")] int? lines = 10)
    {
        try
        {
            var params_info = new { Lines = lines };
            
            if (!File.Exists(LogFilePath))
            {
                string error = $"Log file does not exist at {LogFilePath}";
                LogToolExecution(nameof(TailLog), params_info, $"ERROR: {error}");
                return error;
            }

            int lineCount = lines ?? 10;
            var logLines = new List<string>();
            
            using (var stream = new FileStream(LogFilePath, FileMode.Open, FileAccess.Read, FileShare.ReadWrite))
            using (var reader = new StreamReader(stream))
            {
                string line;
                var tempList = new List<string>();
                
                while ((line = await reader.ReadLineAsync()) != null)
                {
                    tempList.Add(line);
                    if (tempList.Count > lineCount)
                    {
                        tempList.RemoveAt(0);
                    }
                }
                
                logLines = tempList;
            }

            string result;
            if (logLines.Count == 0)
            {
                result = "Log file is empty";
                LogToolExecution(nameof(TailLog), params_info, result);
                return result;
            }

            var sb = new StringBuilder();
            sb.AppendLine($"Last {logLines.Count} lines from {LogFilePath}:");
            sb.AppendLine();
            
            foreach (var line in logLines)
            {
                sb.AppendLine(line);
            }

            result = sb.ToString();
            LogToolExecution(nameof(TailLog), params_info, $"Retrieved {logLines.Count} lines");
            return result;
        }
        catch (Exception ex)
        {
            string error = $"Failed to read log: {ex.Message}";
            LogToolExecution(nameof(TailLog), new { Lines = lines }, $"EXCEPTION: {error}");
            return error;
        }
    }

    [McpServerTool]
    public string GetLogPath()
    {
        string result = $"Log file location: {LogFilePath}";
        LogToolExecution(nameof(GetLogPath), new { }, result);
        return result;
    }
}