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
    .AddRoles<IdentityRole>()
    .AddEntityFrameworkStores<ApplicationDbContext>();

// Identity API endpoints emit a bearer token by default; cookies are also
// available for browser sessions. The "Admin" policy gates the backoffice.
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy(AdminEndpoints.AdminRole, p => p.RequireRole(AdminEndpoints.AdminRole));
});

// Stripe configuration + service.
builder.Services.Configure<StripeOptions>(builder.Configuration.GetSection(StripeOptions.SectionName));
builder.Services.AddScoped<IStripeService, StripeService>();

// Audit logging for backoffice actions.
builder.Services.AddScoped<IAuditLogger, AuditLogger>();

// Clock abstraction used by the bearer-token refresh endpoint.
builder.Services.AddSingleton(TimeProvider.System);

builder.Services.AddEndpointsApiExplorer();

var app = builder.Build();

// ----------------------------------------------------------------------------
// Apply migrations automatically on startup
// ----------------------------------------------------------------------------
using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    var db = services.GetRequiredService<ApplicationDbContext>();
    db.Database.Migrate();

    // Ensure the Admin role exists and seed the admin account from configuration.
    var roleManager = services.GetRequiredService<RoleManager<IdentityRole>>();
    if (!await roleManager.RoleExistsAsync(AdminEndpoints.AdminRole))
        await roleManager.CreateAsync(new IdentityRole(AdminEndpoints.AdminRole));

    var adminEmail = builder.Configuration["Admin:Email"];
    var adminPassword = builder.Configuration["Admin:Password"];
    if (!string.IsNullOrWhiteSpace(adminEmail) && !string.IsNullOrWhiteSpace(adminPassword))
    {
        var userManager = services.GetRequiredService<UserManager<ApplicationUser>>();
        var admin = await userManager.FindByEmailAsync(adminEmail);
        var ok = true;

        if (admin is null)
        {
            admin = new ApplicationUser { UserName = adminEmail, Email = adminEmail, EmailConfirmed = true };
            var created = await userManager.CreateAsync(admin, adminPassword);
            ok = created.Succeeded;
            if (ok)
                app.Logger.LogInformation("Seeded admin account {Email}.", adminEmail);
            else
                app.Logger.LogError("Failed to seed admin user: {Errors}",
                    string.Join("; ", created.Errors.Select(e => e.Description)));
        }
        else
        {
            // The configured password is the source of truth — reset it on every
            // startup so changing the env var actually changes the login.
            var token = await userManager.GeneratePasswordResetTokenAsync(admin);
            var reset = await userManager.ResetPasswordAsync(admin, token, adminPassword);
            ok = reset.Succeeded;
            if (!ok)
                app.Logger.LogError("Failed to update admin password: {Errors}",
                    string.Join("; ", reset.Errors.Select(e => e.Description)));
        }

        if (ok && !await userManager.IsInRoleAsync(admin, AdminEndpoints.AdminRole))
            await userManager.AddToRoleAsync(admin, AdminEndpoints.AdminRole);
    }
    else
    {
        app.Logger.LogWarning("Admin:Email / Admin:Password not configured — no admin account seeded.");
    }
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

// Public runtime config + admin backoffice.
app.MapConfigEndpoints();
app.MapAdminEndpoints();

app.MapGet("/health", () => Results.Ok(new { status = "ok" })).WithTags("System");

app.Run();
