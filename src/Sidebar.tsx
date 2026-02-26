// Infinite Chat v3.3 [BUILD: 2026-02-26 11:05]
import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

interface SidebarProps {
    onSelectChat: (chat: any) => void;
    selectedChatId?: string;
    user: any;
}

export default function Sidebar({ onSelectChat, selectedChatId, user }: SidebarProps) {
    const [chats, setChats] = useState<any[]>([]);
    const [search, setSearch] = useState('');
    const [activeTab, setActiveTab] = useState<'chats' | 'calls' | 'contacts'>('chats');
    const [users, setUsers] = useState<any[]>([]);

    useEffect(() => {
        if (!user) return;
        ensureGlobalLobbyMember();
        fetchChats();

        const subscription = supabase
            .channel('public:chats')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'chats' }, () => {
                fetchChats();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(subscription);
        };
    }, [user]);

    const ensureGlobalLobbyMember = async () => {
        const globalChatId = '00000000-0000-0000-0000-000000000000';
        const { error } = await supabase.from('chat_members').insert([
            { chat_id: globalChatId, user_id: user.id }
        ]);
        if (!error) fetchChats();
    };

    const fetchChats = async () => {
        const { data } = await supabase
            .from('chats')
            .select('*, chat_members!inner(user_id), messages(content, created_at)')
            .eq('chat_members.user_id', user.id)
            .order('created_at', { ascending: false });

        if (data) {
            // Sort by latest message if available
            const sorted = data.sort((a, b) => {
                const aTime = a.messages?.[0]?.created_at || a.created_at;
                const bTime = b.messages?.[0]?.created_at || b.created_at;
                return new Date(bTime).getTime() - new Date(aTime).getTime();
            });
            setChats(sorted);
        }
    };

    const createNewChat = async () => {
        try {
            const chatName = `New Chat ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
            const { data: chatData, error: chatError } = await supabase
                .from('chats')
                .insert([{ name: chatName, is_group: false, created_by: user.id }])
                .select()
                .single();

            if (chatError) throw chatError;

            const { error: memberError } = await supabase.from('chat_members').insert([
                { chat_id: chatData.id, user_id: user.id }
            ]);

            if (memberError) throw memberError;

            // CRITICAL: Switch to chats tab so the user sees the new entry!
            setActiveTab('chats');
            onSelectChat(chatData);
            fetchChats();
        } catch (err: any) {
            console.error("Chat creation error:", err);
            alert("Could not start chat: " + (err.message || "Checking permissions..."));
        }
    };

    const handleSearchUsers = async (query: string) => {
        setSearch(query);
        if (!query.trim()) {
            setUsers([]);
            return;
        }
        try {
            // Search by name or email
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .or(`name.ilike.%${query}%,email.ilike.%${query}%`)
                .limit(10);

            if (error) {
                // Fallback search if email column doesn't exist yet
                const { data: fallbackData } = await supabase
                    .from('users')
                    .select('*')
                    .ilike('name', `%${query}%`)
                    .limit(10);
                if (fallbackData) setUsers(fallbackData);
            } else if (data) {
                setUsers(data);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const fetchAllUsers = async () => {
        const { data } = await supabase.from('users').select('*').limit(50);
        if (data) setUsers(data);
    };

    useEffect(() => {
        if (activeTab === 'contacts') {
            fetchAllUsers();
        }
    }, [activeTab]);

    const calls = [
        { id: 1, name: 'Alice', type: 'audio', status: 'Missed', time: 'Yesterday' },
        { id: 2, name: 'Bob', type: 'video', status: 'Outgoing', time: 'Wednesday' },
    ];

    const startNewChat = async (targetUser: any) => {
        if (targetUser.id === user.id) return alert("You can't chat with yourself!");

        // 1. Check for existing 1:1 chat
        try {
            const { data: myChats } = await supabase
                .from('chat_members')
                .select('chat_id, chats!inner(is_group)')
                .eq('user_id', user.id)
                .eq('chats.is_group', false);

            if (myChats && myChats.length > 0) {
                const chatIds = myChats.map(c => c.chat_id);
                const { data: sharedChat } = await supabase
                    .from('chat_members')
                    .select('chat_id')
                    .in('chat_id', chatIds)
                    .eq('user_id', targetUser.id)
                    .maybeSingle();

                if (sharedChat) {
                    const { data: chatData } = await supabase
                        .from('chats')
                        .select('*')
                        .eq('id', sharedChat.chat_id)
                        .single();
                    if (chatData) {
                        onSelectChat(chatData);
                        setActiveTab('chats');
                        return;
                    }
                }
            }

            // 2. Create new chat if none exists
            const { data: chatData, error: chatError } = await supabase
                .from('chats')
                .insert([{ name: targetUser.name || targetUser.email || 'Personal Chat', is_group: false }])
                .select()
                .single();

            if (chatError) throw chatError;

            const { error: memberError } = await supabase.from('chat_members').insert([
                { chat_id: chatData.id, user_id: user.id },
                { chat_id: chatData.id, user_id: targetUser.id }
            ]);

            if (memberError) throw memberError;

            onSelectChat(chatData);
            setActiveTab('chats');
            fetchChats();
        } catch (err: any) {
            console.error("Chat creation error:", err);
            alert("Could not start chat: " + (err.message || "Please check your database permissions"));
        }
    };

    const deleteChat = async (e: React.MouseEvent, chatId: string) => {
        e.stopPropagation(); // Don't select the chat when clicking delete
        if (!window.confirm("Are you sure you want to delete this chat?")) return;

        try {
            const { error } = await supabase.from('chats').delete().eq('id', chatId);
            if (error) throw error;
            fetchChats();
        } catch (err: any) {
            console.error("Delete error:", err);
            alert("Error deleting chat: " + err.message);
        }
    };

    const clearAllChats = async () => {
        if (!window.confirm("WARNING: This will delete ALL your chats except the Global Lobby. Proceed?")) return;
        try {
            const { error } = await supabase
                .from('chats')
                .delete()
                .neq('id', '00000000-0000-0000-0000-000000000000')
                .eq('created_by', user.id);
            if (error) throw error;
            fetchChats();
        } catch (err: any) {
            console.error("Clear error:", err);
            alert("Error clearing chats: " + err.message);
        }
    };

    useEffect(() => {
        // FORCE ALERT TO PROVE VERSION 3.4 IS LOADED
        if (user) {
            console.log("whatsapp clone v3.4 loaded");
        }
    }, [user]);

    return (
        <div style={styles.sidebar}>
            <div style={styles.verticalTabs}>
                <div style={{ ...styles.tabIcon, color: activeTab === 'chats' ? '#00a884' : '#aebac1' }} title="Chats" onClick={() => setActiveTab('chats')}>💬</div>
                <div style={{ ...styles.tabIcon, color: activeTab === 'calls' ? '#00a884' : '#aebac1' }} title="Calls" onClick={() => setActiveTab('calls')}>📞</div>
                <div style={{ ...styles.tabIcon, color: activeTab === 'contacts' ? '#00a884' : '#aebac1' }} title="Contacts" onClick={() => setActiveTab('contacts')}>⭕</div>
                <div style={{ ...styles.tabIcon, marginTop: 'auto' }} onClick={() => supabase.auth.signOut()}>⏻</div>
            </div>

            <div style={styles.contentArea}>
                <div style={{ backgroundColor: '#ff0055', color: '#fff', padding: '10px', fontSize: '14px', fontWeight: 'bold', textAlign: 'center', borderBottom: '2px solid #fff' }}>
                    🚨 VERSION 3.4 ULTRA ACTIVE - DELETE IS NOW LIVE! 🚨
                </div>
                <div style={styles.header}>
                    <h2 style={styles.headerTitle}>{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}</h2>
                    <div style={styles.headerActions}>
                        <button style={styles.iconBtn} onClick={createNewChat} title="New Chat">+</button>
                        <button style={styles.iconBtn} title="Logout" onClick={() => supabase.auth.signOut()}>⏻</button>
                    </div>
                </div>

                <div style={{ backgroundColor: '#ffd700', color: '#000', padding: '4px 12px', fontSize: '12px', fontWeight: 'bold', textAlign: 'center' }}>
                    🚀 PRODUCTION V3.2 ACTIVE - REFRESH IF YOU DON'T SEE THIS
                </div>

                <div style={styles.searchBar}>
                    <div style={styles.searchContainer}>
                        <span style={styles.searchIcon}>🔍</span>
                        <input
                            style={styles.searchInput}
                            placeholder="Search or start new chat"
                            value={search}
                            onChange={(e) => activeTab === 'contacts' ? handleSearchUsers(e.target.value) : setSearch(e.target.value)}
                        />
                    </div>
                </div>

                {activeTab === 'chats' && chats.length > 1 && (
                    <div style={{ padding: '8px 16px', borderBottom: '1px solid #202c33' }}>
                        <button onClick={clearAllChats} style={{ width: '100%', padding: '8px', backgroundColor: '#313d45', color: '#f15c5c', border: '1px solid #f15c5c', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                            🗑️ CLEAR ALL CHATS
                        </button>
                    </div>
                )}

                <div style={styles.chatList}>
                    {activeTab === 'contacts' ? (
                        <div>
                            {users.map(u => (
                                <div key={u.id} style={styles.chatItem} onClick={() => startNewChat(u)}>
                                    <img src={u.avatar_url || "https://ui-avatars.com/api/?name=" + (u.name || 'U')} style={styles.chatAvatar} alt="" />
                                    <div style={styles.chatInfo}><div style={styles.name}>{u.name || u.email || u.id.slice(0, 8)}</div></div>
                                </div>
                            ))}
                        </div>
                    ) : activeTab === 'calls' ? (
                        <div>
                            {calls.map(call => (
                                <div key={call.id} style={styles.chatItem}>
                                    <img src={"https://ui-avatars.com/api/?name=" + call.name} style={styles.chatAvatar} alt="" />
                                    <div style={styles.chatInfo}>
                                        <div style={styles.chatHeader}>
                                            <span style={styles.name}>{call.name}</span>
                                            <span style={styles.time}>{call.time}</span>
                                        </div>
                                        <div style={{ ...styles.chatStatus, color: call.status === 'Missed' ? '#f15c5c' : '#8696a0' }}>
                                            {call.type === 'video' ? '📹' : '📞'} {call.status}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        chats.map(chat => (
                            <div key={chat.id} className="chat-item-container" style={{ ...styles.chatItem, backgroundColor: selectedChatId === chat.id ? '#2a3942' : 'transparent' }} onClick={() => onSelectChat(chat)}>
                                <img src={chat.avatar_url || "https://ui-avatars.com/api/?name=" + (chat.name || 'C')} style={styles.chatAvatar} alt="" />
                                <div style={styles.chatInfo}>
                                    <div style={styles.chatHeader}>
                                        <span style={styles.name}>{chat.name || 'Global Lobby'}</span>
                                        {chat.messages?.[0] && (
                                            <span style={styles.time}>
                                                {new Date(chat.messages[0].created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        )}
                                    </div>
                                    <div style={styles.lastMsg}>
                                        {chat.messages?.[0]?.content || "No messages yet"}
                                    </div>
                                </div>
                                {chat.id !== '00000000-0000-0000-0000-000000000000' && (
                                    <button className="delete-btn" style={styles.deleteBtn} onClick={(e) => deleteChat(e, chat.id)} title="Delete Chat">
                                        <span style={{ marginRight: '4px' }}>🗑️</span>
                                        <span style={{ fontSize: '11px', fontWeight: 'bold' }}>DELETE</span>
                                    </button>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>
            <style>{`
                .delete-btn { opacity: 0.6; transition: opacity 0.2s; }
                .delete-btn:hover { opacity: 1 !important; transform: scale(1.1); }
            `}</style>
        </div>
    );
}

const styles: Record<string, React.CSSProperties> = {
    sidebar: { width: '450px', display: 'flex', backgroundColor: '#111b21', height: '100vh', borderRight: '1px solid #313d45' },
    verticalTabs: { width: '60px', backgroundColor: '#202c33', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '15px 0', gap: '20px', borderRight: '1px solid #313d45' },
    tabIcon: { fontSize: '24px', cursor: 'pointer', color: '#aebac1', transition: 'color 0.2s' },
    contentArea: { flex: 1, display: 'flex', flexDirection: 'column' },
    header: { height: '60px', padding: '0 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#111b21' },
    headerTitle: { fontSize: '22px', fontWeight: 'bold', color: '#e9edef' },
    headerActions: { display: 'flex', gap: '15px' },
    iconBtn: { background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#aebac1' },
    searchBar: { padding: '8px 12px', borderBottom: '1px solid #202c33' },
    searchContainer: { display: 'flex', alignItems: 'center', backgroundColor: '#202c33', borderRadius: '8px', padding: '0 12px' },
    searchIcon: { color: '#8696a0', marginRight: '8px' },
    searchInput: { padding: '8px 4px', background: 'none', border: 'none', flex: 1, outline: 'none', fontSize: '14px', color: '#e9edef' },
    chatList: { flex: 1, overflowY: 'auto', backgroundColor: '#111b21' },
    chatItem: { display: 'flex', padding: '12px 16px', gap: '12px', cursor: 'pointer', borderBottom: '1px solid #202c33', transition: 'background-color 0.2s' },
    chatAvatar: { width: '49px', height: '49px', borderRadius: '50%' },
    chatInfo: { flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' },
    chatHeader: { display: 'flex', justifyContent: 'space-between' },
    name: { fontWeight: '500', fontSize: '16px', color: '#e9edef' },
    time: { fontSize: '12px', color: '#8696a0' },
    emptyTab: { padding: '40px', textAlign: 'center', color: '#8696a0' },
    chatStatus: { fontSize: '13px', color: '#8696a0', marginTop: '2px' },
    deleteBtn: {
        backgroundColor: '#ea0038',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        padding: '6px 10px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 'auto',
        boxShadow: '0 2px 4px rgba(0,0,0,0.5)',
        zIndex: 10
    }
};
