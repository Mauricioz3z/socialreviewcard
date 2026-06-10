using System.Collections.Concurrent;

namespace SocialReviewCard.Services;

/// <summary>
/// In-memory per-user daily counter for screenshot scans. Each scan costs real
/// money (a vision API call), so even Pro users get a generous daily ceiling.
/// Counts reset on UTC day change and on process restart — acceptable for a
/// single-instance deployment; move to the DB if the API ever scales out.
/// </summary>
public sealed class ScanQuotaTracker
{
    private readonly ConcurrentDictionary<string, (DateOnly Day, int Count)> _counts = new();

    /// <summary>Atomically claims one scan; false when the daily limit is reached.</summary>
    public bool TryClaim(string userId, int dailyLimit, out int used)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var entry = _counts.AddOrUpdate(
            userId,
            _ => (today, 1),
            (_, prev) => prev.Day == today ? (today, prev.Count + 1) : (today, 1));

        used = entry.Count;
        if (entry.Count <= dailyLimit) return true;

        // Over the limit — undo the increment so retries after midnight work
        // from an accurate count (best-effort; races only ever under-count).
        _counts.TryUpdate(userId, (entry.Day, dailyLimit), entry);
        used = dailyLimit;
        return false;
    }
}
