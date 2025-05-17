using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using ModelContextProtocol.Server;
using OtakMcpCommander;
using System.IO;
using System.Text.Json;

// ログファイルのパス
var logDirectory = Path.Combine(Environment.CurrentDirectory, "logs");
var mcpLogFilePath = Path.Combine(logDirectory, "mcp-commander.log");

// ログディレクトリを確保
if (!Directory.Exists(logDirectory))
{
    Directory.CreateDirectory(logDirectory);
}

// ログサーバー起動時のエントリを記録
File.AppendAllText(mcpLogFilePath, $"[SERVER] {DateTime.Now:yyyy-MM-dd HH:mm:ss} - MCP Commander Server starting...\n");

var builder = Host.CreateApplicationBuilder(args);

// Configure logging
builder.Logging.ClearProviders();
builder.Logging.AddConsole();
builder.Logging.SetMinimumLevel(LogLevel.Debug);

// Register tools explicitly
builder.Services.AddSingleton<CommanderTools>();

// 現在のバージョンではイベントハンドラをサポートしていないため、
// 基本的なログ記録のみを行います
File.AppendAllText(mcpLogFilePath, $"[SERVER] {DateTime.Now:yyyy-MM-dd HH:mm:ss} - MCP Server configured\n");

// Configure MCP server
var serverBuilder = builder.Services
    .AddMcpServer()
    .WithTools<CommanderTools>()
    .WithStdioServerTransport();

var app = builder.Build();
var logger = app.Services.GetRequiredService<ILogger<Program>>();
logger.LogInformation("MCP Commander Server starting...");

// Start the server and wait for it to complete
await app.StartAsync();
File.AppendAllText(mcpLogFilePath, $"[SERVER] {DateTime.Now:yyyy-MM-dd HH:mm:ss} - MCP Commander Server started successfully\n");

await app.WaitForShutdownAsync();

// サーバー停止時のログ記録
File.AppendAllText(mcpLogFilePath, $"[SERVER] {DateTime.Now:yyyy-MM-dd HH:mm:ss} - MCP Commander Server stopped\n");
logger.LogInformation("MCP Commander Server stopped.");
