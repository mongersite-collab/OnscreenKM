// ONSCREENKM — سرور واسط (اختیاری)
// اگر پروایدری اجازه‌ی تماس مستقیم از مرورگر را نداد (CORS)، این را اجرا کنید:
//     cd backend && dotnet run

using System.Net.Http.Headers;
using System.Text;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddCors(o => o.AddDefaultPolicy(p =>
    p.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod()));
var app = builder.Build();
app.UseCors();

var http = new HttpClient();

const string KmSystem =
    "اسم تو KM است. تو دستیار هوشمند KM (ONSCREENKM) هستی. " +
    "اگر کسی اسمت یا هویتت را پرسید، همیشه فقط بگو: KM. " +
    "هرگز نگو ChatGPT یا OpenAI یا Claude یا Gemini هستی. کوتاه و دقیق پاسخ بده.";

app.MapGet("/health", () => Results.Json(new { ok = true, name = "KM", version = "5.0" }));
app.MapGet("/v1/system-prompt", () => Results.Json(new { system = KmSystem }));

app.MapPost("/v1/chat", async (HttpRequest req) =>
{
    var upstream = Environment.GetEnvironmentVariable("KM_UPSTREAM_URL")
                   ?? "https://api.openai.com/v1/chat/completions";
    var key = Environment.GetEnvironmentVariable("KM_UPSTREAM_KEY") ?? "";

    using var reader = new StreamReader(req.Body);
    var body = await reader.ReadToEndAsync();

    var msg = new HttpRequestMessage(HttpMethod.Post, upstream)
    {
        Content = new StringContent(body, Encoding.UTF8, "application/json")
    };
    if (!string.IsNullOrEmpty(key))
        msg.Headers.Authorization = new AuthenticationHeaderValue("Bearer", key);

    var res = await http.SendAsync(msg);
    var text = await res.Content.ReadAsStringAsync();
    return Results.Content(text, "application/json", Encoding.UTF8, (int)res.StatusCode);
});

app.Run("http://localhost:5178");
