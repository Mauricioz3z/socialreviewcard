namespace SocialReviewCard.Models;

/// <summary>Public submission from the in-app feedback form.</summary>
public class FeedbackRequest
{
    public string Type { get; set; } = "suggestion";
    public string Message { get; set; } = string.Empty;
    public string? Email { get; set; }
}

public class FeedbackDto
{
    public Guid Id { get; set; }
    public DateTime CreatedAt { get; set; }
    public string Type { get; set; } = "";
    public string Message { get; set; } = "";
    public string? Email { get; set; }
    public bool Handled { get; set; }
    public string? IpAddress { get; set; }
}

public class FeedbackListResponse
{
    public int Total { get; set; }
    public int Unhandled { get; set; }
    public List<FeedbackDto> Items { get; set; } = new();
}

public class FeedbackHandledRequest
{
    public bool Handled { get; set; }
}
