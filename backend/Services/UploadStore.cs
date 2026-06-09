using System.Text.RegularExpressions;

namespace SocialReviewCard.Services;

/// <summary>
/// Persistent storage for admin-uploaded assets (botanical SVGs/PNGs used by reel
/// themes). Lives outside the publish folder so deploys don't wipe it; the path
/// is configurable via `Uploads:Path` (set an absolute path in prod).
/// </summary>
public class UploadStore
{
    public string Root { get; }

    public UploadStore(IConfiguration cfg, IHostEnvironment env)
    {
        var configured = cfg["Uploads:Path"];
        Root = string.IsNullOrWhiteSpace(configured)
            ? Path.Combine(env.ContentRootPath, "uploads")
            : configured;
        Directory.CreateDirectory(Root);
    }

    /// <summary>Builds a safe, unique file name from the original upload name.</summary>
    public static string SafeName(string originalName)
    {
        var ext = Path.GetExtension(originalName).ToLowerInvariant();
        var stem = Path.GetFileNameWithoutExtension(originalName);
        stem = Regex.Replace(stem, "[^a-zA-Z0-9-]+", "-").Trim('-').ToLowerInvariant();
        if (string.IsNullOrEmpty(stem)) stem = "asset";
        return $"{stem}-{Guid.NewGuid():N}"[..Math.Min(stem.Length + 9, 48)] + ext;
    }

    public string PathFor(string name) => Path.Combine(Root, Path.GetFileName(name));
}
