using SQLite;
using System;
using System.Collections.Generic;
using System.IO;
using System.Threading.Tasks;
using ArborChat.Models; // Added this line

namespace ArborChat.Services
{
    public class DatabaseService : IDatabaseService
    {
        private SQLiteAsyncConnection _database;

        public DatabaseService()
        {
        }

        public DatabaseService(SQLiteAsyncConnection connection)
        {
            _database = connection;
        }

        private async Task Init()
        {
            if (_database is not null)
            {
                await _database.CreateTableAsync<ChatSession>();
                await _database.CreateTableAsync<ChatMessage>();
                await _database.CreateTableAsync<Settings>();
                return;
            }

            _database = new SQLiteAsyncConnection(Constants.DatabasePath, Constants.Flags);
            await _database.CreateTableAsync<ChatSession>();
            await _database.CreateTableAsync<ChatMessage>();
            await _database.CreateTableAsync<Settings>();
        }

        // --- ChatSession CRUD ---
        public async Task<List<ChatSession>> GetChatSessionsAsync()
        {
            await Init();
            return await _database.Table<ChatSession>().ToListAsync();
        }

        public async Task<ChatSession> GetChatSessionAsync(int id)
        {
            await Init();
            return await _database.Table<ChatSession>().Where(i => i.Id == id).FirstOrDefaultAsync();
        }

        public async Task<int> SaveChatSessionAsync(ChatSession session)
        {
            await Init();
            if (session.Id != 0)
            {
                session.LastModifiedDate = DateTime.UtcNow;
                return await _database.UpdateAsync(session);
            }
            else
            {
                session.CreatedDate = DateTime.UtcNow;
                session.LastModifiedDate = DateTime.UtcNow;
                return await _database.InsertAsync(session);
            }
        }

        public async Task<int> DeleteChatSessionAsync(ChatSession session)
        {
            await Init();
            return await _database.DeleteAsync(session);
        }

        // --- ChatMessage CRUD ---
        public async Task<List<ChatMessage>> GetChatMessagesAsync(int sessionId)
        {
            await Init();
            return await _database.Table<ChatMessage>().Where(m => m.SessionId == sessionId && m.ParentMessageId == null).ToListAsync();
        }

        public async Task<List<ChatMessage>> GetThreadMessagesAsync(int parentMessageId)
        {
            await Init();
            return await _database.Table<ChatMessage>().Where(m => m.ParentMessageId == parentMessageId).ToListAsync();
        }

        public async Task<int> SaveChatMessageAsync(ChatMessage message)
        {
            await Init();
            if (message.Id != 0)
            {
                return await _database.UpdateAsync(message);
            }
            else
            {
                return await _database.InsertAsync(message);
            }
        }

        public async Task<int> DeleteChatMessageAsync(ChatMessage message)
        {
            await Init();
            return await _database.DeleteAsync(message);
        }

        // --- Settings CRUD ---
        public async Task<Settings> GetSettingsAsync()
        {
            await Init();
            // There should only be one settings entry
            return await _database.Table<Settings>().FirstOrDefaultAsync();
        }

        public async Task<int> SaveSettingsAsync(Settings settings)
        {
            await Init();
            if (settings.Id != 0)
            {
                return await _database.UpdateAsync(settings);
            }
            else
            {
                return await _database.InsertAsync(settings);
            }
        }
    }
}
