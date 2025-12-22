using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using System.Collections.ObjectModel;
using System.Threading.Tasks;
using ArborChat.Models;
using ArborChat.Services;
using System.Windows.Input;
using System.Linq; // Added for .Any() and .First()
using System; // Added for DateTime.UtcNow

namespace ArborChat.ViewModels
{
    public partial class MainViewModel : ObservableObject
    {
        private readonly IDatabaseService _databaseService;

        [ObservableProperty]
        private ObservableCollection<ChatSession> _chatSessions;

        [ObservableProperty]
        private ChatSession _selectedChatSession;

        [ObservableProperty]
        private ObservableCollection<ChatMessage> _currentChatMessages;

                [ObservableProperty]
                private string _newMessageText;
        
                [ObservableProperty]
                private ChatMessage _selectedThreadParentMessage;
        
                [ObservableProperty] // New property
                private ObservableCollection<ChatMessage> _currentThreadMessages;
        
                [ObservableProperty] // New property
                private string _newThreadMessageText;

                        [ObservableProperty] // New property for loading indicator
                        private bool _isBusy;
                
                        [ObservableProperty] // New property for thread panel visibility
                        private bool _isThreadPanelVisible;
                
                        public ICommand NewChatCommand { get; }
                        public ICommand SendMessageCommand { get; }
                        public ICommand SelectChatSessionCommand { get; }
                        public ICommand StartThreadCommand { get; }
                        public ICommand SendThreadMessageCommand { get; }
                        public ICommand CloseThreadCommand { get; } // New command
                
                        public MainViewModel(IDatabaseService databaseService, bool loadData = true)
                        {
                            _databaseService = databaseService;
                            ChatSessions = new ObservableCollection<ChatSession>();
                            CurrentChatMessages = new ObservableCollection<ChatMessage>();
                            CurrentThreadMessages = new ObservableCollection<ChatMessage>(); // Initialize
                
                            NewChatCommand = new AsyncRelayCommand(NewChat);
                            SendMessageCommand = new AsyncRelayCommand(SendMessage);
                            SelectChatSessionCommand = new AsyncRelayCommand<ChatSession>(SelectChatSession);
                            StartThreadCommand = new AsyncRelayCommand<ChatMessage>(StartThread);
                            SendThreadMessageCommand = new AsyncRelayCommand(SendThreadMessage);
                            CloseThreadCommand = new RelayCommand(CloseThread); // New command initialization
                
                            if (loadData)
                            {
                                LoadChatSessions();
                            }
                        }
                
                        partial void OnSelectedThreadParentMessageChanged(ChatMessage value)
                        {
                            IsThreadPanelVisible = value != null;
                        }                
                        private async void LoadChatSessions()
                        {
                            IsBusy = true; // Set busy
                            var sessions = await _databaseService.GetChatSessionsAsync();
                            ChatSessions = new ObservableCollection<ChatSession>(sessions);
                
                            if (ChatSessions.Any())
                            {
                                SelectedChatSession = ChatSessions.First();
                                await LoadMessagesForSelectedSession();
                            }
                            else
                            {
                                await NewChat();
                            }
                            IsBusy = false; // Not busy
                        }                
                        private async Task NewChat()
                        {
                            IsBusy = true; // Set busy
                            var newSession = new ChatSession();
                            await _databaseService.SaveChatSessionAsync(newSession);
                            ChatSessions.Add(newSession);
                            SelectedChatSession = newSession;
                            CurrentChatMessages.Clear();
                            SelectedThreadParentMessage = null; // Close thread when starting new chat
                            CurrentThreadMessages.Clear(); // Clear thread messages
                            IsBusy = false; // Not busy
                        }                
                        private async Task SelectChatSession(ChatSession session)
                        {
                            if (session == null || SelectedChatSession == session)
                                return;
                
                            IsBusy = true; // Set busy
                            SelectedChatSession = session;
                            await LoadMessagesForSelectedSession();
                            SelectedThreadParentMessage = null; // Close thread when switching sessions
                            CurrentThreadMessages.Clear(); // Clear thread messages
                            IsBusy = false; // Not busy
                        }                
                        private async Task LoadMessagesForSelectedSession()
                        {
                            if (SelectedChatSession != null)
                            {
                                var messages = await _databaseService.GetChatMessagesAsync(SelectedChatSession.Id);
                                CurrentChatMessages = new ObservableCollection<ChatMessage>(messages);
                            }
                            else
                            {
                                CurrentChatMessages.Clear();
                            }
                        }
                
                        private async Task SendMessage()
                        {
                            if (SelectedChatSession == null || string.IsNullOrWhiteSpace(NewMessageText))
                                return;
                
                            IsBusy = true; // Set busy
                            var userMessage = new ChatMessage
                            {
                                SessionId = SelectedChatSession.Id,
                                Role = "user",
                                Content = NewMessageText,
                                Timestamp = DateTime.UtcNow
                            };
                
                            await _databaseService.SaveChatMessageAsync(userMessage);
                            CurrentChatMessages.Add(userMessage);
                            NewMessageText = string.Empty;
                
                            // TODO: Call AI service here
                            // var aiResponse = await _aiService.GetResponseAsync(CurrentChatMessages.ToList());
                            // await _databaseService.SaveChatMessageAsync(aiResponse);
                            // CurrentChatMessages.Add(aiResponse);
                            IsBusy = false; // Not busy
                        }                
                        private async Task StartThread(ChatMessage parentMessage)
                        {
                            if (parentMessage == null)
                                return;
                
                            IsBusy = true; // Set busy
                            SelectedThreadParentMessage = parentMessage;
                            await LoadThreadMessagesForSelectedParent();
                            IsBusy = false; // Not busy
                            // No alert needed, as the UI will show the panel
                        }                
                        private async Task LoadThreadMessagesForSelectedParent()
                        {
                            if (SelectedThreadParentMessage != null)
                            {
                                var messages = await _databaseService.GetThreadMessagesAsync(SelectedThreadParentMessage.Id);
                                CurrentThreadMessages = new ObservableCollection<ChatMessage>(messages);
                            }
                            else
                            {
                                CurrentThreadMessages.Clear();
                            }
                        }
                
                                private async Task SendThreadMessage()
                                {
                                    if (SelectedThreadParentMessage == null || string.IsNullOrWhiteSpace(NewThreadMessageText))
                                        return;
                        
                                    IsBusy = true; // Set busy
                                    var userMessage = new ChatMessage
                                    {
                                        SessionId = SelectedThreadParentMessage.SessionId,
                                        ParentMessageId = SelectedThreadParentMessage.Id,
                                        Role = "user",
                                        Content = NewThreadMessageText,
                                        Timestamp = DateTime.UtcNow
                                    };
                        
                                    await _databaseService.SaveChatMessageAsync(userMessage);
                                    CurrentThreadMessages.Add(userMessage);
                                    NewThreadMessageText = string.Empty;
                        
                                    // Build conversation history for AI (main chat up to parent, then thread messages)
                                    var conversationHistory = new List<ChatMessage>();
                        
                                    // 1. Get main chat messages up to the parent message
                                    var mainMessages = await _databaseService.GetChatMessagesAsync(SelectedThreadParentMessage.SessionId);
                                    foreach (var msg in mainMessages)
                                    {
                                        conversationHistory.Add(msg);
                                        if (msg.Id == SelectedThreadParentMessage.Id)
                                        {
                                            break; // Stop after adding the parent message
                                        }
                                    }
                                    
                                    // 2. Add the current thread messages
                                    conversationHistory.AddRange(CurrentThreadMessages);
                        
                                    // TODO: Call AI service for thread response
                                    // var aiResponse = await _aiService.GetResponseAsync(conversationHistory);
                                    // await _databaseService.SaveChatMessageAsync(aiResponse);
                                    // CurrentThreadMessages.Add(aiResponse);
                                    IsBusy = false; // Not busy
                                }                
                        // New method to close the thread panel
                        private void CloseThread()
                        {
                            SelectedThreadParentMessage = null;
                            CurrentThreadMessages.Clear();
                            NewThreadMessageText = string.Empty;
                        }
                    }}
