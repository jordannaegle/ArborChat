global using Azure.AI.OpenAI;
using Microsoft.Extensions.Logging;
using ArborChat.Services; // Added
using ArborChat.ViewModels; // Added
using ArborChat.Views; // Added

namespace ArborChat;

public static class MauiProgram
{
	public static MauiApp CreateMauiApp()
	{
		var builder = MauiApp.CreateBuilder();
		builder
			.UseMauiApp<App>()
			.ConfigureFonts(fonts =>
			{
				fonts.AddFont("OpenSans-Regular.ttf", "OpenSansRegular");
				fonts.AddFont("OpenSans-Semibold.ttf", "OpenSansSemibold");
			});

#if DEBUG
		builder.Logging.AddDebug();
#endif
		// Register services
		builder.Services.AddSingleton<IDatabaseService, DatabaseService>(); // Added
		builder.Services.AddTransient<SettingsViewModel>(); // Added
        builder.Services.AddTransient(provider => new MainViewModel(provider.GetRequiredService<IDatabaseService>(), true));
        builder.Services.AddTransient<MainPage>(); // Added
        builder.Services.AddTransient<SettingsPage>(); // Added


		return builder.Build();
	}
}
