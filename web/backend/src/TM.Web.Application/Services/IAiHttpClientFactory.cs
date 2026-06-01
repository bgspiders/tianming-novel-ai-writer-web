namespace TM.Web.Application.Services;

public interface IAiHttpClientFactory
{
    HttpClient CreateOpenAiCompatibleClient();
}
