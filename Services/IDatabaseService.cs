using ArborChat.Models;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace ArborChat.Services
{
    public interface IDatabaseService
    {
        Task<List<ChatSession>> GetChatSessionsAsync();
        Task<ChatSession> GetChatSessionAsync(int id);
        Task<int> SaveChatSessionAsync(ChatSession session);
        Task<int> DeleteChatSessionAsync(ChatSession session);
        Task<List<ChatMessage>> GetChatMessagesAsync(int sessionId);
        Task<List<ChatMessage>> GetThreadMessagesAsync(int parentMessageId);
        Task<int> SaveChatMessageAsync(ChatMessage message);
        Task<int> DeleteChatMessageAsync(ChatMessage message);
        Task<Settings> GetSettingsAsync();
        Task<int> SaveSettingsAsync(Settings settings);
    }
}
