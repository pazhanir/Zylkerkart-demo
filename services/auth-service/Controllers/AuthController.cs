using Microsoft.AspNetCore.Mvc;
using ZylkerKart.AuthService.DTOs;
using ZylkerKart.AuthService.Services;

namespace ZylkerKart.AuthService.Controllers;

[ApiController]
[Route("auth")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;
    private readonly ChaosService _chaos;

    public AuthController(IAuthService authService, ChaosService chaos)
    {
        _authService = authService;
        _chaos = chaos;
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request)
    {
        // Chaos: network latency
        if (_chaos.IsNetworkLatencyActive)
            await Task.Delay(_chaos.NetworkLatencyMs);

        // Chaos: exception storm
        if (_chaos.IsExceptionStormActive && Random.Shared.NextDouble() < 0.6)
            throw new Exception("[CHAOS] Exception storm - random unhandled exception!");

        try
        {
            var result = await _authService.Register(request);
            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { error = ex.Message });
        }
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        // Chaos: network latency
        if (_chaos.IsNetworkLatencyActive)
            await Task.Delay(_chaos.NetworkLatencyMs);

        // Chaos: exception storm
        if (_chaos.IsExceptionStormActive && Random.Shared.NextDouble() < 0.6)
            throw new Exception("[CHAOS] Exception storm - random unhandled exception!");

        try
        {
            var ip = HttpContext.Connection.RemoteIpAddress?.ToString();
            var ua = Request.Headers.UserAgent.ToString();
            var result = await _authService.Login(request, ip, ua);
            return Ok(result);
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(new { error = ex.Message });
        }
    }

    [HttpPost("refresh")]
    public async Task<IActionResult> Refresh([FromBody] RefreshRequest request)
    {
        try
        {
            var result = await _authService.RefreshToken(request.RefreshToken);
            return Ok(result);
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(new { error = ex.Message });
        }
    }

    [HttpGet("validate")]
    public async Task<IActionResult> Validate()
    {
        var authHeader = Request.Headers.Authorization.ToString();
        if (string.IsNullOrEmpty(authHeader) || !authHeader.StartsWith("Bearer "))
            return Unauthorized(new ValidateResponse { Valid = false, Message = "Missing token" });

        var token = authHeader["Bearer ".Length..];
        var result = await _authService.ValidateToken(token);

        if (!result.Valid)
            return Unauthorized(result);

        return Ok(result);
    }

    [HttpPost("logout")]
    public async Task<IActionResult> Logout([FromBody] RefreshRequest request)
    {
        await _authService.Logout(request.RefreshToken);
        return Ok(new { message = "Logged out successfully" });
    }
}
