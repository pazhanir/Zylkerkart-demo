using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ZylkerKart.AuthService.Data;
using ZylkerKart.AuthService.Services;

namespace ZylkerKart.AuthService.Controllers;

[ApiController]
[Route("simulate")]
public class ChaosController : ControllerBase
{
    private readonly ChaosService _chaos;
    private readonly IServiceProvider _serviceProvider;

    public ChaosController(ChaosService chaos, IServiceProvider serviceProvider)
    {
        _chaos = chaos;
        _serviceProvider = serviceProvider;
    }

    /// <summary>
    /// Brute-force login simulation - rapid-fire login attempts
    /// </summary>
    [HttpPost("brute-force")]
    public async Task<IActionResult> StartBruteForce()
    {
        _chaos.StartBruteForce();
        var cts = _chaos.GetBruteForceCts();

        _ = Task.Run(async () =>
        {
            using var scope = _serviceProvider.CreateScope();
            var auth = scope.ServiceProvider.GetRequiredService<IAuthService>();
            int count = 0;

            while (!cts.Token.IsCancellationRequested && count < 200)
            {
                try
                {
                    await auth.Login(
                        new DTOs.LoginRequest
                        {
                            Email = "demo@zylkerkart.com",
                            Password = $"wrong_password_{count}"
                        },
                        "127.0.0.1",
                        "ChaosBot/1.0"
                    );
                }
                catch { /* Expected failures */ }

                count++;
                await Task.Delay(50, cts.Token);
            }

            Console.WriteLine($"[CHAOS] Brute-force completed: {count} attempts");
        }, cts.Token);

        return Ok(new
        {
            chaos = "brute-force",
            status = "started",
            message = "Rapid-fire login attempts (200 at 50ms interval). Check user_activity table."
        });
    }

    [HttpPost("brute-force/stop")]
    public IActionResult StopBruteForce()
    {
        _chaos.StopBruteForce();
        return Ok(new { chaos = "brute-force", status = "stopped" });
    }

    /// <summary>
    /// Exception storm - random unhandled exceptions in auth endpoints
    /// </summary>
    [HttpPost("exception-storm")]
    public IActionResult StartExceptionStorm()
    {
        _chaos.StartExceptionStorm();
        return Ok(new
        {
            chaos = "exception-storm",
            status = "started",
            message = "60% of auth requests will throw unhandled exceptions"
        });
    }

    [HttpPost("exception-storm/stop")]
    public IActionResult StopExceptionStorm()
    {
        _chaos.StopExceptionStorm();
        return Ok(new { chaos = "exception-storm", status = "stopped" });
    }

    /// <summary>
    /// Connection leak - open DB connections without closing them
    /// </summary>
    [HttpPost("connection-leak")]
    public async Task<IActionResult> StartConnectionLeak()
    {
        _chaos.StartConnectionLeak();

        _ = Task.Run(async () =>
        {
            int count = 0;
            while (_chaos.IsConnectionLeakActive && count < 50)
            {
                try
                {
                    using var scope = _serviceProvider.CreateScope();
                    var db = scope.ServiceProvider.GetRequiredService<AuthDbContext>();

                    // Open connection and intentionally don't dispose properly
                    var conn = db.Database.GetDbConnection();
                    await conn.OpenAsync();
                    _chaos.AddLeakedConnection(conn);

                    // Keep connection open
                    await Task.Delay(1000);
                    count++;
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[CHAOS] Connection leak stopped at {count}: {ex.Message}");
                    break;
                }
            }

            Console.WriteLine($"[CHAOS] Leaked {count} connections");
        });

        return Ok(new
        {
            chaos = "connection-leak",
            status = "started",
            message = "Opening DB connections without closing. Pool will exhaust."
        });
    }

    [HttpPost("connection-leak/stop")]
    public IActionResult StopConnectionLeak()
    {
        _chaos.StopConnectionLeak();
        return Ok(new
        {
            chaos = "connection-leak",
            status = "stopped",
            leakedConnections = _chaos.LeakedConnectionCount
        });
    }

    /// <summary>
    /// Network latency - add artificial delay to all auth requests
    /// </summary>
    [HttpPost("network-latency")]
    public IActionResult StartNetworkLatency([FromQuery] int ms = 3000)
    {
        _chaos.StartNetworkLatency(ms);
        return Ok(new
        {
            chaos = "network-latency",
            status = "started",
            latencyMs = ms,
            message = $"All auth endpoints will have {ms}ms artificial delay"
        });
    }

    [HttpPost("network-latency/stop")]
    public IActionResult StopNetworkLatency()
    {
        _chaos.StopNetworkLatency();
        return Ok(new { chaos = "network-latency", status = "stopped" });
    }

    [HttpGet("status")]
    public IActionResult GetStatus()
    {
        return Ok(_chaos.GetStatus());
    }
}
