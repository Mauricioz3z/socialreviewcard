using System.ComponentModel.DataAnnotations;

namespace SocialReviewCard.Models;

/// <summary>Payload for exchanging a Google ID token for an app bearer token.</summary>
public class GoogleLoginRequest
{
    [Required]
    public string IdToken { get; set; } = string.Empty;
}

/// <summary>Payload for refreshing an app bearer token.</summary>
public class RefreshRequest
{
    [Required]
    public string RefreshToken { get; set; } = string.Empty;
}
