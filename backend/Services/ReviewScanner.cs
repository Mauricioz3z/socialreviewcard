using System.Net;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Extensions.Options;

namespace SocialReviewCard.Services;

/// <summary>Structured fields extracted from a review screenshot.</summary>
public sealed record ScannedReview(
    bool Found,
    string Review,
    string ReviewerName,
    int Rating,
    string Platform);

/// <summary>Raised when the vision provider rejects the request or misbehaves.</summary>
public sealed class ReviewScanException : Exception
{
    public ReviewScanException(string message, Exception? inner = null) : base(message, inner) { }
}

public interface IReviewScanner
{
    bool IsConfigured { get; }
    Task<ScannedReview> ScanAsync(byte[] imageBytes, string mediaType, CancellationToken ct);
}

/// <summary>
/// Extracts review text/name/rating/platform from a screenshot using the
/// Anthropic Messages API (vision + forced tool use so the reply is always
/// schema-valid JSON — no free-text parsing).
/// </summary>
public sealed class AnthropicReviewScanner : IReviewScanner
{
    private const string ApiUrl = "https://api.anthropic.com/v1/messages";
    private const string ApiVersion = "2023-06-01";
    private const string ToolName = "extract_review";

    private const string SystemPrompt =
        "You read screenshots of customer reviews (from marketplaces, app stores, " +
        "Google, social media or chat apps) and extract the fields verbatim. " +
        "Copy the review text exactly as written, in its original language - never " +
        "translate, paraphrase or fix typos. If the screenshot contains several " +
        "reviews, pick the most complete one. If it contains no customer review at " +
        "all, set found to false and leave the other fields empty.";

    // Forced tool schema: the model must reply with exactly these fields.
    private static readonly string ToolsJson = JsonSerializer.Serialize(new[]
    {
        new
        {
            name = ToolName,
            description = "Report the customer review found in the screenshot.",
            input_schema = new
            {
                type = "object",
                properties = new Dictionary<string, object>
                {
                    ["found"] = new { type = "boolean", description = "True only if the image contains a customer review." },
                    ["review"] = new { type = "string", description = "The review text, verbatim. Empty when found=false." },
                    ["reviewer_name"] = new { type = "string", description = "Customer name or handle as displayed, else empty." },
                    ["rating"] = new { type = "integer", description = "Star rating 1-5 if visible, else 0." },
                    ["platform"] = new { type = "string", description = "Platform the review is from (e.g. Etsy, Google, Amazon) if identifiable from the UI, else empty." },
                },
                required = new[] { "found", "review", "reviewer_name", "rating", "platform" },
            },
        },
    });

    private readonly HttpClient _http;
    private readonly AnthropicOptions _options;
    private readonly ILogger<AnthropicReviewScanner> _logger;

    public AnthropicReviewScanner(HttpClient http, IOptions<AnthropicOptions> options, ILogger<AnthropicReviewScanner> logger)
    {
        _http = http;
        _options = options.Value;
        _logger = logger;
    }

    public bool IsConfigured => _options.IsConfigured;

    public async Task<ScannedReview> ScanAsync(byte[] imageBytes, string mediaType, CancellationToken ct)
    {
        if (!IsConfigured)
            throw new ReviewScanException("Screenshot import is not configured.");

        var body = new JsonObject
        {
            ["model"] = _options.Model,
            ["max_tokens"] = 1024,
            ["system"] = SystemPrompt,
            ["tools"] = JsonNode.Parse(ToolsJson),
            ["tool_choice"] = new JsonObject { ["type"] = "tool", ["name"] = ToolName },
            ["messages"] = new JsonArray
            {
                new JsonObject
                {
                    ["role"] = "user",
                    ["content"] = new JsonArray
                    {
                        new JsonObject
                        {
                            ["type"] = "image",
                            ["source"] = new JsonObject
                            {
                                ["type"] = "base64",
                                ["media_type"] = mediaType,
                                ["data"] = Convert.ToBase64String(imageBytes),
                            },
                        },
                        new JsonObject { ["type"] = "text", ["text"] = "Extract the review from this screenshot." },
                    },
                },
            },
        };

        using var request = new HttpRequestMessage(HttpMethod.Post, ApiUrl)
        {
            Content = new StringContent(body.ToJsonString(), Encoding.UTF8, "application/json"),
        };
        request.Headers.Add("x-api-key", _options.ApiKey);
        request.Headers.Add("anthropic-version", ApiVersion);

        HttpResponseMessage response;
        try
        {
            response = await _http.SendAsync(request, ct);
        }
        catch (HttpRequestException ex)
        {
            throw new ReviewScanException("Could not reach the vision provider.", ex);
        }

        var payload = await response.Content.ReadAsStringAsync(ct);
        if (!response.IsSuccessStatusCode)
        {
            // Log the provider error server-side; never echo it to the client.
            _logger.LogError("Anthropic API error {Status}: {Body}", (int)response.StatusCode, Truncate(payload, 600));
            throw new ReviewScanException(response.StatusCode == HttpStatusCode.TooManyRequests
                ? "The vision provider is rate-limiting us. Try again in a minute."
                : "The vision provider rejected the request.");
        }

        return ParseToolResult(payload);
    }

    private static ScannedReview ParseToolResult(string payload)
    {
        try
        {
            using var doc = JsonDocument.Parse(payload);
            foreach (var block in doc.RootElement.GetProperty("content").EnumerateArray())
            {
                if (block.GetProperty("type").GetString() != "tool_use") continue;
                var input = block.GetProperty("input");
                var rating = input.TryGetProperty("rating", out var r) && r.TryGetInt32(out var n) ? n : 0;
                return new ScannedReview(
                    Found: input.TryGetProperty("found", out var f) && f.ValueKind == JsonValueKind.True,
                    Review: StringOf(input, "review"),
                    ReviewerName: StringOf(input, "reviewer_name"),
                    Rating: Math.Clamp(rating, 0, 5),
                    Platform: StringOf(input, "platform"));
            }
            throw new ReviewScanException("The vision provider returned no extraction result.");
        }
        catch (Exception ex) when (ex is JsonException or KeyNotFoundException or InvalidOperationException)
        {
            throw new ReviewScanException("Could not parse the vision provider response.", ex);
        }
    }

    private static string StringOf(JsonElement input, string name) =>
        input.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString()!.Trim() : string.Empty;

    private static string Truncate(string s, int max) => s.Length <= max ? s : s[..max];
}
