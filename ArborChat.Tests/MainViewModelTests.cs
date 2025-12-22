using ArborChat.ViewModels;
using ArborChat.Services;
using Moq;
using ArborChat.Models;
using System.Collections.ObjectModel;

namespace ArborChat.Tests
{
    public class MainViewModelTests
    {
        private readonly Mock<IDatabaseService> _mockDatabaseService;
        private readonly MainViewModel _viewModel;

        public MainViewModelTests()
        {
            _mockDatabaseService = new Mock<IDatabaseService>();

            // Set up the mock to return empty lists by default
            _mockDatabaseService.Setup(db => db.GetChatSessionsAsync()).ReturnsAsync(new List<ChatSession>());
            _mockDatabaseService.Setup(db => db.GetChatMessagesAsync(It.IsAny<int>())).ReturnsAsync(new List<ChatMessage>());
            _mockDatabaseService.Setup(db => db.GetThreadMessagesAsync(It.IsAny<int>())).ReturnsAsync(new List<ChatMessage>());

            _viewModel = new MainViewModel(_mockDatabaseService.Object, false);
        }

        [Fact]
        public async Task NewChatCommand_CreatesNewSessionAndClearsMessages()
        {
            // Arrange
            _viewModel.CurrentChatMessages.Add(new ChatMessage()); // Ensure there's a message to be cleared

            // Act
            await ((CommunityToolkit.Mvvm.Input.IAsyncRelayCommand)_viewModel.NewChatCommand).ExecuteAsync(null);

            // Assert
            Assert.Single(_viewModel.ChatSessions);
            Assert.Empty(_viewModel.CurrentChatMessages);
            Assert.NotNull(_viewModel.SelectedChatSession);
            _mockDatabaseService.Verify(db => db.SaveChatSessionAsync(It.IsAny<ChatSession>()), Times.Once);
        }

        [Fact]
        public async Task SendMessageCommand_SavesMessageAndClearsInput()
        {
            // Arrange
            var session = new ChatSession();
            _viewModel.SelectedChatSession = session;
            _viewModel.NewMessageText = "Hello";

            // Act
            await ((CommunityToolkit.Mvvm.Input.IAsyncRelayCommand)_viewModel.SendMessageCommand).ExecuteAsync(null);

            // Assert
            Assert.Single(_viewModel.CurrentChatMessages);
            Assert.Equal("Hello", _viewModel.CurrentChatMessages[0].Content);
            Assert.Empty(_viewModel.NewMessageText);
            _mockDatabaseService.Verify(db => db.SaveChatMessageAsync(It.IsAny<ChatMessage>()), Times.Once);
        }

        [Fact]
        public async Task SelectChatSessionCommand_LoadsMessagesForSelectedSession()
        {
            // Arrange
            var session1 = new ChatSession { Id = 1 };
            var session2 = new ChatSession { Id = 2 };
            _viewModel.ChatSessions.Add(session1);
            _viewModel.ChatSessions.Add(session2);
            _viewModel.SelectedChatSession = session1;

            var messages = new List<ChatMessage>
            {
                new ChatMessage { Id = 1, SessionId = 2, Content = "Message 1" },
                new ChatMessage { Id = 2, SessionId = 2, Content = "Message 2" }
            };
            _mockDatabaseService.Setup(db => db.GetChatMessagesAsync(2)).ReturnsAsync(messages);

            // Act
            await ((CommunityToolkit.Mvvm.Input.IAsyncRelayCommand<ChatSession>)_viewModel.SelectChatSessionCommand).ExecuteAsync(session2);

            // Assert
            Assert.Equal(session2, _viewModel.SelectedChatSession);
            Assert.Equal(2, _viewModel.CurrentChatMessages.Count);
            Assert.Equal("Message 1", _viewModel.CurrentChatMessages[0].Content);
        }

        [Fact]
        public async Task StartThreadCommand_SetsSelectedThreadParentMessage()
        {
            // Arrange
            var parentMessage = new ChatMessage { Id = 1, Content = "Parent Message" };
            var threadMessages = new List<ChatMessage>
            {
                new ChatMessage { Id = 2, ParentMessageId = 1, Content = "Thread Message 1" },
                new ChatMessage { Id = 3, ParentMessageId = 1, Content = "Thread Message 2" }
            };
            _mockDatabaseService.Setup(db => db.GetThreadMessagesAsync(1)).ReturnsAsync(threadMessages);

            // Act
            await ((CommunityToolkit.Mvvm.Input.IAsyncRelayCommand<ChatMessage>)_viewModel.StartThreadCommand).ExecuteAsync(parentMessage);

            // Assert
            Assert.Equal(parentMessage, _viewModel.SelectedThreadParentMessage);
            Assert.Equal(2, _viewModel.CurrentThreadMessages.Count);
            Assert.Equal("Thread Message 1", _viewModel.CurrentThreadMessages[0].Content);
        }

        [Fact]
        public async Task SendThreadMessageCommand_SavesThreadMessageAndClearsInput()
        {
            // Arrange
            var parentMessage = new ChatMessage { Id = 1, SessionId = 1 };
            _viewModel.SelectedThreadParentMessage = parentMessage;
            _viewModel.NewThreadMessageText = "Hello Thread";

            // Act
            await ((CommunityToolkit.Mvvm.Input.IAsyncRelayCommand)_viewModel.SendThreadMessageCommand).ExecuteAsync(null);

            // Assert
            Assert.Single(_viewModel.CurrentThreadMessages);
            Assert.Equal("Hello Thread", _viewModel.CurrentThreadMessages[0].Content);
            Assert.Empty(_viewModel.NewThreadMessageText);
            _mockDatabaseService.Verify(db => db.SaveChatMessageAsync(It.IsAny<ChatMessage>()), Times.Once);
        }
    }
}
