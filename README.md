# ArborChat

A chat application built with .NET MAUI.

## Prerequisites

To build and run this application, you will need:

*   [.NET 9 SDK](https://dotnet.microsoft.com/download/dotnet/9.0)
*   The .NET MAUI workload. You can install it by running the following command:
    ```
    dotnet workload install maui
    ```

## Running the application

To run the application on Windows, use the following command:

```
dotnet build -t:Run -f net9.0-windows10.0.19041.0
```

You can also run the application on other platforms:

*   **Android:** `dotnet build -t:Run -f net9.0-android`
*   **iOS:** `dotnet build -t:Run -f net9.0-ios`
*   **Mac Catalyst:** `dotnet build -t:Run -f net9.0-maccatalyst`

## Project Structure

The main files in the project are:

*   `ArborChat.csproj`: The main project file for the .NET MAUI application.
*   `MauiProgram.cs`: The entry point of the application, where the app is configured and services are registered.
*   `App.xaml` and `App.xaml.cs`: The main application class.
*   `AppShell.xaml` and `AppShell.xaml.cs`: The shell of the application, used for navigation.
*   `MainPage.xaml` and `MainPage.xaml.cs`: The main page of the application.
*   `Platforms/`: Contains platform-specific code.
*   `Resources/`: Contains shared resources like images, fonts, and the app icon.
