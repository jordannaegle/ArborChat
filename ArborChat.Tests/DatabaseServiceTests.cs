using ArborChat.Services;
using ArborChat.Models;
using SQLite;

namespace ArborChat.Tests
{
    public class DatabaseServiceTests : IDisposable
    {
        private readonly SQLiteAsyncConnection _connection;
        private readonly DatabaseService _databaseService;

        public DatabaseServiceTests()
        {
            // Use an in-memory database for testing
            _connection = new SQLiteAsyncConnection(":memory:");
            _databaseService = new DatabaseService(_connection);
        }

        public void Dispose()
        {
            _connection.CloseAsync().Wait();
        }

        [Fact]
        public async Task SaveAndGetChatSession()
        {
            // Arrange
            var session = new ChatSession { Title = "Test Session" };

            // Act
            await _databaseService.SaveChatSessionAsync(session);
            var sessions = await _databaseService.GetChatSessionsAsync();
            var retrievedSession = await _databaseService.GetChatSessionAsync(session.Id);

            // Assert
            Assert.Single(sessions);
            Assert.NotNull(retrievedSession);
            Assert.Equal("Test Session", retrievedSession.Title);
        }

        [Fact]
        public async Task DeleteChatSession()
        {
            // Arrange
            var session = new ChatSession { Title = "Test Session" };
            await _databaseService.SaveChatSessionAsync(session);

            // Act
            await _databaseService.DeleteChatSessionAsync(session);
            var sessions = await _databaseService.GetChatSessionsAsync();

            // Assert
            Assert.Empty(sessions);
        }

        [Fact]
        public async Task SaveAndGetChatMessage()
        {
            // Arrange
            var session = new ChatSession();
            await _databaseService.SaveChatSessionAsync(session);
            var message = new ChatMessage { SessionId = session.Id, Content = "Test Message" };

            // Act
            await _databaseService.SaveChatMessageAsync(message);
            var messages = await _databaseService.GetChatMessagesAsync(session.Id);

            // Assert
            Assert.Single(messages);
            Assert.Equal("Test Message", messages[0].Content);
        }

        [Fact]
        public async Task SaveAndGetThreadMessage()
        {
            // Arrange
            var session = new ChatSession();
            await _databaseService.SaveChatSessionAsync(session);
            var parentMessage = new ChatMessage { SessionId = session.Id, Content = "Parent Message" };
            await _databaseService.SaveChatMessageAsync(parentMessage);
            var threadMessage = new ChatMessage { SessionId = session.Id, ParentMessageId = parentMessage.Id, Content = "Thread Message" };

            // Act
            await _databaseService.SaveChatMessageAsync(threadMessage);
            var messages = await _databaseService.GetThreadMessagesAsync(parentMessage.Id);

            // Assert
            Assert.Single(messages);
            Assert.Equal("Thread Message", messages[0].Content);
        }

        [Fact]
        public async Task DeleteChatMessage()
        {
            // Arrange
            var session = new ChatSession();
            await _databaseService.SaveChatSessionAsync(session);
            var message = new ChatMessage { SessionId = session.Id, Content = "Test Message" };
            await _databaseService.SaveChatMessageAsync(message);

            // Act
            await _databaseService.DeleteChatMessageAsync(message);
            var messages = await _databaseService.GetChatMessagesAsync(session.Id);

            // Assert
            Assert.Empty(messages);
        }

        [Fact]
        public async Task SaveAndGetSettings()
        {
            // Arrange
            var settings = new Settings { OpenAIKey = "key", GeminiKey = "key2", SelectedAIModel = "model" };

            // Act
            await _databaseService.SaveSettingsAsync(settings);
            var retrievedSettings = await _databaseService.GetSettingsAsync();

            // Assert
            Assert.NotNull(retrievedSettings);
            Assert.Equal("key", retrievedSettings.OpenAIKey);
        }
    }
}
