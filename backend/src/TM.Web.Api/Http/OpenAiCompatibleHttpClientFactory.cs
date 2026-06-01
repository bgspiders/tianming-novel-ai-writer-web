using System.Net;
using System.Net.Http;
using System.Net.Security;
using System.Security.Cryptography.X509Certificates;
using Microsoft.Extensions.Options;
using TM.Web.Application.Services;

namespace TM.Web.Api.Http;

internal sealed class OpenAiCompatibleHttpClientFactory : IAiHttpClientFactory, IDisposable
{
    private readonly HttpClient _client;

    public OpenAiCompatibleHttpClientFactory(IOptions<OutboundHttpProxyOptions> proxyOptions)
    {
        _client = new HttpClient(CreateHandler(proxyOptions.Value), disposeHandler: true);
    }

    public HttpClient CreateOpenAiCompatibleClient() => _client;

    public void Dispose()
    {
        _client.Dispose();
    }

    private static HttpMessageHandler CreateHandler(OutboundHttpProxyOptions options)
    {
        var handler = new SocketsHttpHandler();

        if (!string.IsNullOrWhiteSpace(options.Url)
            && Uri.TryCreate(options.Url, UriKind.Absolute, out var proxyUri))
        {
            handler.UseProxy = true;
            handler.Proxy = BuildProxy(options, proxyUri);
        }

        if (OperatingSystem.IsMacOS())
        {
            // Some OpenAI-compatible endpoints validate fine in curl/browser but fail in .NET on macOS
            // because OCSP/CRL status cannot be resolved. Keep normal chain/hostname validation and
            // disable only revocation lookups for this outbound AI client.
            handler.SslOptions = new SslClientAuthenticationOptions
            {
                CertificateRevocationCheckMode = X509RevocationMode.NoCheck
            };
        }

        return handler;
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
