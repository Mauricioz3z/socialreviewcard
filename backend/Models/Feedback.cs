namespace SocialReviewCard.Models;

/// <summary>
/// A message submitted from the in-app feedback form (suggestion, criticism or
/// support request). Readable from the admin backoffice.
/// </summary>
public class Feedback
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    /// <summary>One of: "suggestion", "criticism", "support".</summary>
    public string Type { get; set; } = "suggestion";

    public string Message { get; set; } = string.Empty;

    /// <summary>Optional contact email (prefilled from the session when signed in).</summary>
    public string? Email { get; set; }

    /// <summary>Identity user id when the sender was signed in; null otherwise.</summary>
    public string? UserId { get; set; }

    /// <summary>Whether an admin has marked this as dealt with.</summary>
    public bool Handled { get; set; }

    public string? IpAddress { get; set; }
}
