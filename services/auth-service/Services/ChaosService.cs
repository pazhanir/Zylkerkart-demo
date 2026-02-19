namespace ZylkerKart.AuthService.Services;

/// <summary>
/// Manages chaos engineering simulation state for the Auth Service.
/// Chaos scenarios: brute-force login, exception storm, connection leak, network latency
/// </summary>
public class ChaosService
{
    private volatile bool _bruteForceActive;
    private volatile bool _exceptionStormActive;
    private volatile bool _connectionLeakActive;
    private volatile bool _networkLatencyActive;
    private readonly List<object> _leakedConnections = new();
    private CancellationTokenSource? _bruteForceCts;
    private int _networkLatencyMs = 3000;

    public bool IsBruteForceActive => _bruteForceActive;
    public bool IsExceptionStormActive => _exceptionStormActive;
    public bool IsConnectionLeakActive => _connectionLeakActive;
    public bool IsNetworkLatencyActive => _networkLatencyActive;
    public int NetworkLatencyMs => _networkLatencyMs;

    public void StartBruteForce() => _bruteForceActive = true;
    public void StopBruteForce()
    {
        _bruteForceActive = false;
        _bruteForceCts?.Cancel();
    }

    public void StartExceptionStorm() => _exceptionStormActive = true;
    public void StopExceptionStorm() => _exceptionStormActive = false;

    public void StartConnectionLeak() => _connectionLeakActive = true;
    public void StopConnectionLeak()
    {
        _connectionLeakActive = false;
        lock (_leakedConnections)
        {
            _leakedConnections.Clear();
        }
    }

    public void AddLeakedConnection(object conn)
    {
        lock (_leakedConnections)
        {
            _leakedConnections.Add(conn);
        }
    }

    public int LeakedConnectionCount
    {
        get
        {
            lock (_leakedConnections)
            {
                return _leakedConnections.Count;
            }
        }
    }

    public void StartNetworkLatency(int ms = 3000)
    {
        _networkLatencyMs = ms;
        _networkLatencyActive = true;
    }

    public void StopNetworkLatency() => _networkLatencyActive = false;

    public CancellationTokenSource GetBruteForceCts()
    {
        _bruteForceCts = new CancellationTokenSource();
        return _bruteForceCts;
    }

    public object GetStatus() => new
    {
        bruteForceActive = _bruteForceActive,
        exceptionStormActive = _exceptionStormActive,
        connectionLeakActive = _connectionLeakActive,
        networkLatencyActive = _networkLatencyActive,
        networkLatencyMs = _networkLatencyMs,
        leakedConnections = LeakedConnectionCount
    };
}
