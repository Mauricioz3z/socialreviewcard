using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using SocialReviewCard.Data;
using SocialReviewCard.Endpoints;
using SocialReviewCard.Models;
using SocialReviewCard.Services;

var builder = WebApplication.CreateBuilder(args);

// ----------------------------------------------------------------------------
// Configuration
// ----------------------------------------------------------------------------
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
if (string.IsNullOrWhiteSpace(connectionString))
    throw new InvalidOperationException(
        "Connection string 'DefaultConnection' is not configured. " +
        "Set it via user-secrets (dev) or the ConnectionStrings__DefaultConnection env var (prod).");

const string CorsPolicy = "FrontendCors";
var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
    ?? new[] { "https://socialreviewcard.com" };

// ----------------------------------------------------------------------------
// Services
// ----------------------------------------------------------------------------
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseNpgsql(connectionString));

builder.Services.AddCors(options =>
{
    options.AddPolicy(CorsPolicy, policy =>
        policy.WithOrigins(allowedOrigins)
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials());
});

// Native .NET 8 Identity with API endpoint support, persisted to PostgreSQL.
builder.Services
    .AddIdentityApiEndpoints<ApplicationUser>(options =>
    {
        options.User.RequireUniqueEmail = true;
        options.Password.RequiredLength = 8;
        options.SignIn.RequireConfirmedEmail = false;
    })
    .AddEntityFrameworkStores<ApplicationDbContext>();

// Identity API endpoints emit a bearer token by default; cookies are also
// available for browser sessions. Authorization is enabled for [Authorize]/RequireAuthorization.
builder.Services.AddAuthorization();

// Stripe configuration + service.
builder.Services.Configure<StripeOptions>(builder.Configuration.GetSection(StripeOptions.SectionName));
builder.Services.AddScoped<IStripeService, StripeService>();

// Clock abstraction used by the bearer-token refresh endpoint.
builder.Services.AddSingleton(TimeProvider.System);

builder.Services.AddEndpointsApiExplorer();

var app = builder.Build();

// ----------------------------------------------------------------------------
// Apply migrations automatically on startup
// ----------------------------------------------------------------------------
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    db.Database.Migrate();
}

// ----------------------------------------------------------------------------
// Middleware pipeline
// ----------------------------------------------------------------------------
if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();
}

app.UseCors(CorsPolicy);

app.UseAuthentication();
app.UseAuthorization();

// ----------------------------------------------------------------------------
// Endpoints
// ----------------------------------------------------------------------------

// Google-only auth: /api/auth/google and /api/auth/refresh
// (replaces the native password-based Identity API endpoints by design).
app.MapAuthEndpoints();

app.MapCardEndpoints();
app.MapBillingEndpoints();
app.MapUsageEndpoints();

app.MapGet("/health", () => Results.Ok(new { status = "ok" })).WithTags("System");

app.Run();
