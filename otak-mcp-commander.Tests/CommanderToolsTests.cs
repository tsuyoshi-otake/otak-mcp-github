using System;
using System.Diagnostics;
using System.IO;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading.Tasks;
using Xunit;
using Xunit.Abstractions;

namespace OtakMcpCommander.Tests
{
    public class CommanderToolsTests : IDisposable
    {
        private readonly Process _mcpProcess;
        private readonly ITestOutputHelper _output;
        private int _requestId = 1;

        // JSON-RPCリクエスト用のクラス
        private class JsonRpcRequest
        {
            [JsonPropertyName("jsonrpc")]
            public string JsonRpc { get; set; } = "2.0";

            [JsonPropertyName("id")]
            public int Id { get; set; }

            [JsonPropertyName("method")]
            public string Method { get; set; }

            [JsonPropertyName("params")]
            public object Params { get; set; }
        }

        // JSON-RPCレスポンス用のクラス
        private class JsonRpcResponse
        {
            [JsonPropertyName("jsonrpc")]
            public string JsonRpc { get; set; }

            [JsonPropertyName("id")]
            public int Id { get; set; }

            [JsonPropertyName("result")]
            public JsonElement? Result { get; set; }

            [JsonPropertyName("error")]
            public JsonRpcError Error { get; set; }

            public bool IsSuccess => Error == null;
        }

        private class JsonRpcError
        {
            [JsonPropertyName("code")]
            public int Code { get; set; }

            [JsonPropertyName("message")]
            public string Message { get; set; }
        }

        public CommanderToolsTests(ITestOutputHelper output)
        {
            _output = output;
            
            // MCPサーバープロセスの開始（dotnet runを使用）
            _mcpProcess = new Process
            {
                StartInfo = new ProcessStartInfo
                {
                    FileName = "dotnet",
                    Arguments = "run --project ../../../otak-mcp-commander/otak-mcp-commander.csproj --no-build",
                    UseShellExecute = false,
                    RedirectStandardInput = true,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    CreateNoWindow = true,
                    WorkingDirectory = Directory.GetCurrentDirectory()
                }
            };

            _output.WriteLine("Starting MCP server using 'dotnet run'");

            _mcpProcess.Start();
            
            // プロセスが起動するまで少し待機
            Task.Delay(1000).Wait();
            
            // 標準エラー出力を非同期で読み取り、テスト出力に転送
            _mcpProcess.ErrorDataReceived += (sender, args) =>
            {
                if (!string.IsNullOrEmpty(args.Data))
                {
                    _output.WriteLine($"MCP Server Error: {args.Data}");
                }
            };
            _mcpProcess.BeginErrorReadLine();

            // サーバーの起動を待つ
            Task.Delay(1000).Wait();
        }

        public void Dispose()
        {
            try
            {
                // プロセスが実行中の場合は終了
                if (!_mcpProcess.HasExited)
                {
                    _mcpProcess.Kill();
                }
            }
            catch (Exception ex)
            {
                _output.WriteLine($"Error disposing MCP process: {ex.Message}");
            }
            finally
            {
                _mcpProcess.Dispose();
            }
        }

        // MCPサーバーにリクエストを送信し、レスポンスを受信するヘルパーメソッド
        private async Task<JsonRpcResponse> SendRequestAsync(string method, object parameters = null)
        {
            var request = new JsonRpcRequest
            {
                Id = _requestId++,
                Method = method,
                Params = parameters ?? new { }
            };

            var requestJson = JsonSerializer.Serialize(request);
            _output.WriteLine($"Sending request: {requestJson}");

            // リクエストを送信
            await _mcpProcess.StandardInput.WriteLineAsync(requestJson);
            await _mcpProcess.StandardInput.FlushAsync();

            // レスポンスを読み取り
            var responseJson = await _mcpProcess.StandardOutput.ReadLineAsync();
            _output.WriteLine($"Received response: {responseJson}");

            if (string.IsNullOrEmpty(responseJson))
            {
                throw new InvalidOperationException("Empty response received from MCP server");
            }

            return JsonSerializer.Deserialize<JsonRpcResponse>(responseJson);
        }

        [Fact]
        public async Task GetCurrentDirectory_ReturnsValidDirectory()
        {
            // Arrange & Act
            var response = await SendRequestAsync("GetCurrentDirectory");

            // Assert
            Assert.NotNull(response);
            Assert.True(response.IsSuccess, $"Request failed: {response.Error?.Message}");
            
            var directory = response.Result?.GetString();
            Assert.NotNull(directory);
            Assert.True(Directory.Exists(directory), $"Directory does not exist: {directory}");
            
            _output.WriteLine($"Current directory: {directory}");
        }

        [Fact]
        public async Task ListFiles_ReturnsValidListing()
        {
            // Arrange & Act
            var response = await SendRequestAsync("ListFiles", new { directory = Directory.GetCurrentDirectory() });

            // Assert
            Assert.NotNull(response);
            Assert.True(response.IsSuccess, $"Request failed: {response.Error?.Message}");
            
            var listing = response.Result?.GetString();
            Assert.NotNull(listing);
            Assert.Contains("Directories:", listing);
            Assert.Contains("Files:", listing);
            
            _output.WriteLine($"File listing: {listing}");
        }

        [Fact]
        public async Task WriteLog_WritesLogEntry()
        {
            // Arrange
            var testMessage = $"Test log entry at {DateTime.Now:yyyy-MM-dd HH:mm:ss}";

            // Act
            var response = await SendRequestAsync("WriteLog", new { message = testMessage });

            // Assert
            Assert.NotNull(response);
            Assert.True(response.IsSuccess, $"Request failed: {response.Error?.Message}");
            
            var result = response.Result?.GetString();
            Assert.NotNull(result);
            Assert.Contains("Log message written:", result);
            Assert.Contains(testMessage, result);
            
            _output.WriteLine($"Write log result: {result}");
        }

        [Fact]
        public async Task TailLog_ReturnsLogEntries()
        {
            // Arrange - まず新しいログを書き込む
            var testMessage = $"TailLog test entry at {DateTime.Now:yyyy-MM-dd HH:mm:ss}";
            await SendRequestAsync("WriteLog", new { message = testMessage });

            // Act
            var response = await SendRequestAsync("TailLog", new { lines = 5 });

            // Assert
            Assert.NotNull(response);
            Assert.True(response.IsSuccess, $"Request failed: {response.Error?.Message}");
            
            var logContents = response.Result?.GetString();
            Assert.NotNull(logContents);
            
            _output.WriteLine($"Log tail: {logContents}");
        }

        [Fact]
        public async Task GetLogPath_ReturnsValidPath()
        {
            // Arrange & Act
            var response = await SendRequestAsync("GetLogPath");

            // Assert
            Assert.NotNull(response);
            Assert.True(response.IsSuccess, $"Request failed: {response.Error?.Message}");
            
            var logPath = response.Result?.GetString();
            Assert.NotNull(logPath);
            Assert.Contains("Log file location:", logPath);
            
            _output.WriteLine($"Log path: {logPath}");
        }

        [Fact]
        public async Task ExecuteCommand_RunsValidCommand()
        {
            // Arrange & Act
            var response = await SendRequestAsync("ExecuteCommand", new { command = "dir" });

            // Assert
            Assert.NotNull(response);
            Assert.True(response.IsSuccess, $"Request failed: {response.Error?.Message}");
            
            var output = response.Result?.GetString();
            Assert.NotNull(output);
            Assert.NotEmpty(output);
            
            _output.WriteLine($"Command output: {output.Substring(0, Math.Min(100, output.Length))}...");
        }
    }
}