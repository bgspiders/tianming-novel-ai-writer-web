using System.Net;

namespace TM.Web.Api.Http;

internal sealed class OutboundHttpProxyOptions
{
    public const string SectionName = "HttpProxy";

    public string? Url { get; init; }

    public string? Username { get; init; }

    public string? Password { get; init; }

    public bool BypassOnLocal { get; init; }

    public string[] BypassList { get; init; } = Array.Empty<string>();
}

internal static class OutboundHttpProxyExtensions
{
    public static IServiceCollection AddOutboundHttpProxy(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.Configure<OutboundHttpProxyOptions>(
            configuration.GetSection(OutboundHttpProxyOptions.SectionName));

        var options = configuration
            .GetSection(OutboundHttpProxyOptions.SectionName)
            .Get<OutboundHttpProxyOptions>();

        if (options is null || string.IsNullOrWhiteSpace(options.Url))
        {
            return services;
        }

        if (!Uri.TryCreate(options.Url, UriKind.Absolute, out var proxyUri))
        {
            throw new InvalidOperationException(
                $"Configuration section '{OutboundHttpProxyOptions.SectionName}' has an invalid Url value.");
        }

        var proxy = BuildProxy(options, proxyUri);

        services.ConfigureHttpClientDefaults(http =>
        {
            http.ConfigurePrimaryHttpMessageHandler(() => new SocketsHttpHandler
            {
                UseProxy = true,
                Proxy = proxy
            });
        });

        return services;
    }

    private static IWebProxy BuildProxy(OutboundHttpProxyOptions options, Uri proxyUri)
    {
        var proxy = new WebProxy(proxyUri, options.BypassOnLocal, options.BypassList);
        var credentials = BuildCredentials(options, proxyUri);
        if (credentials is not null)
        {
            proxy.Credentials = credentials;
        }

        return proxy;
    }

    private static NetworkCredential? BuildCredentials(OutboundHttpProxyOptions options, Uri proxyUri)
    {
        if (!string.IsNullOrWhiteSpace(options.Username))
        {
            return new NetworkCredential(options.Username, options.Password ?? string.Empty);
        }

        if (string.IsNullOrWhiteSpace(proxyUri.UserInfo))
        {
            return null;
        }

        var parts = proxyUri.UserInfo.Split(':', 2, StringSplitOptions.None);
        var username = Uri.UnescapeDataString(parts[0]);
        var password = parts.Length > 1
            ? Uri.UnescapeDataString(parts[1])
            : string.Empty;

        return new NetworkCredential(username, password);
    }
}
