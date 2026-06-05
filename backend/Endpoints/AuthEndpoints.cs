using Google.Apis.Auth;
using Microsoft.AspNetCore.Authentication.BearerToken;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using SocialReviewCard.Models;

namespace SocialReviewCard.Endpoints;

/// <summary>
/// Google-only authentication. The SPA obtains a Google ID token via Google
/// Identity Services and exchanges it here for our standard Identity bearer
/// token (same shape as the native Identity API: accessToken/refreshToken/expiresIn).
/// </summary>
public static class AuthEndpoints
{
    public static RouteGroupBuilder MapAuthEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/auth").WithTags("Auth");

        // POST /api/auth/google -> validate Google ID token, find/create user, issue bearer token.
        group.MapPost("/google", async (
            [FromBody] GoogleLoginRequest request,
            UserManager<ApplicationUser> userManager,
            SignInManager<ApplicationUser> signInManager,
            IConfiguration config,
            ILoggerFactory loggerFactory) =>
        {
            var logger = loggerFactory.CreateLogger("GoogleAuth");

            if (string.IsNullOrWhiteSpace(request.IdToken))
                return Results.BadRequest(new { error = "Missing idToken." });

            var clientId = config["Google:ClientId"];
            if (string.IsNullOrWhiteSpace(clientId))
                return Results.Problem("Google sign-in is not configured.", statusCode: StatusCodes.Status500InternalServerError);

            GoogleJsonWebSignature.Payload payload;
            try
            {
                payload = await GoogleJsonWebSignature.ValidateAsync(
                    request.IdToken,
                    new GoogleJsonWebSignature.ValidationSettings
                    {
                        Audience = new[] { clientId },
                    });
            }
            catch (InvalidJwtException ex)
            {
                logger.LogWarning(ex, "Rejected invalid Google ID token.");
                return Results.Unauthorized();
            }

            if (string.IsNullOrWhiteSpace(payload.Email) || payload.EmailVerified != true)
                return Results.Unauthorized();

            var email = payload.Email.Trim();
            var loginProvider = "Google";
            var providerKey = payload.Subject; // stable Google account id

            // Resolve existing user by external login, then by email; otherwise create one.
            var user = await userManager.FindByLoginAsync(loginProvider, providerKey)
                       ?? await userManager.FindByEmailAsync(email);

            if (user is null)
            {
                user = new ApplicationUser
                {
                    UserName = email,
                    Email = email,
                    EmailConfirmed = true,
                };
                var create = await userManager.CreateAsync(user);
                if (!create.Succeeded)
                {
                    logger.LogError("Failed to create user for {Email}: {Errors}", email,
                        string.Join("; ", create.Errors.Select(e => e.Description)));
                    return Results.Problem("Could not create account.", statusCode: StatusCodes.Status500InternalServerError);
                }
            }

            // Make sure the external login is linked for future logins.
            var logins = await userManager.GetLoginsAsync(user);
            if (!logins.Any(l => l.LoginProvider == loginProvider && l.ProviderKey == providerKey))
            {
                await userManager.AddLoginAsync(user, new UserLoginInfo(loginProvider, providerKey, loginProvider));
            }

            // Issue an Identity bearer token (writes the AccessTokenResponse to the body).
            signInManager.AuthenticationScheme = IdentityConstants.BearerScheme;
            await signInManager.SignInAsync(user, isPersistent: false);
            return Results.Empty;
        })
        .AllowAnonymous();

        // POST /api/auth/refresh -> exchange a valid refresh token for a fresh bearer token.
        group.MapPost("/refresh", async (
            [FromBody] RefreshRequest request,
            SignInManager<ApplicationUser> signInManager,
            IOptionsMonitor<BearerTokenOptions> bearerTokenOptions,
            TimeProvider timeProvider) =>
        {
            if (string.IsNullOrWhiteSpace(request.RefreshToken))
                return Results.Unauthorized();

            var protector = bearerTokenOptions.Get(IdentityConstants.BearerScheme).RefreshTokenProtector;
            var ticket = protector.Unprotect(request.RefreshToken);

            if (ticket?.Properties.ExpiresUtc is not { } expiresUtc
                || timeProvider.GetUtcNow() >= expiresUtc
                || await signInManager.ValidateSecurityStampAsync(ticket.Principal) is not { } user)
            {
                return Results.Unauthorized();
            }

            signInManager.AuthenticationScheme = IdentityConstants.BearerScheme;
            await signInManager.SignInAsync(user, isPersistent: false);
            return Results.Empty;
        })
        .AllowAnonymous();

        return group;
    }
}
