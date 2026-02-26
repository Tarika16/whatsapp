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
    const [showSearch, setShowSearch] = useState(false);
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
            .select('*, chat_members!inner(user_id)')
            .eq('chat_members.user_id', user.id)
            .order('created_at', { ascending: false });
        if (data) setChats(data);
    };

    const openPersonalChat = async () => {
        // 1. Check for existing self-chat
        try {
            const { data: existingChat } = await supabase
                .from('chats')
                .select('id, name, is_group, chat_members!inner(user_id)')
                .eq('is_group', false)
                .eq('name', 'Me (You)')
                .eq('chat_members.user_id', user.id)
                .maybeSingle();

            if (existingChat) {
                onSelectChat(existingChat);
                return;
            }

            // 2. Create new self-chat if none exists
            const { data: chatData, error: chatError } = await supabase
                .from('chats')
                .insert([{ name: 'Me (You)', is_group: false, created_by: user.id }])
                .select()
                .single();

            if (chatError) throw chatError;

            const { error: memberError } = await supabase.from('chat_members').insert([
                { chat_id: chatData.id, user_id: user.id }
            ]);

            if (memberError) throw memberError;

            onSelectChat(chatData);
            fetchChats();
        } catch (err: any) {
            console.error("Personal chat creation error:", err);
            alert("Could not start personal chat: " + (err.message || "Please check your database permissions"));
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
                        setShowSearch(false);
                        setSearch('');
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
            setShowSearch(false);
            setSearch('');
            fetchChats();
        } catch (err: any) {
            console.error("Chat creation error:", err);
            alert("Could not start chat: " + (err.message || "Please check your database permissions"));
        }
    };

    return (
        <div style={styles.sidebar}>
            <div style={styles.verticalTabs}>
                <div style={styles.tabIcon} title="Chats" onClick={() => setActiveTab('chats')}>💬</div>
                <div style={styles.tabIcon} title="Calls" onClick={() => setActiveTab('calls')}>📞</div>
                <div style={styles.tabIcon} title="Status" onClick={() => setActiveTab('contacts')}>⭕</div>
                <div style={{ ...styles.tabIcon, marginTop: 'auto' }} onClick={() => supabase.auth.signOut()}>⏻</div>
            </div>

            <div style={styles.contentArea}>
                <div style={styles.header}>
                    <h2 style={styles.headerTitle}>{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}</h2>
                    <div style={styles.headerActions}>
                        <button style={styles.iconBtn} onClick={createNewChat} title="New Chat">+</button>
                        <button style={styles.iconBtn} title="Logout" onClick={() => supabase.auth.signOut()}>⏻</button>
                    </div>
                </div>

                <div style={styles.searchBar}>
                    <div style={styles.searchContainer}>
                        <span style={styles.searchIcon}>🔍</span>
                        <input
                            style={styles.searchInput}
                            placeholder="Search or start new chat"
                            value={search}
                            onChange={(e) => showSearch ? handleSearchUsers(e.target.value) : setSearch(e.target.value)}
                        />
                    </div>
                </div>

                <div style={styles.chatList}>
                    {showSearch ? (
                        <div>
                            {users.length === 0 && search.trim() !== "" && <div style={styles.emptyTab}>No users found.</div>}
                            {users.map(u => (
                                <div key={u.id} style={styles.chatItem} onClick={() => startNewChat(u)}>
                                    <img src={u.avatar_url || "https://ui-avatars.com/api/?name=" + (u.name || 'U')} style={styles.chatAvatar} alt="" />
                                    <div style={styles.chatInfo}><div style={styles.name}>{u.name || u.email || u.id.slice(0, 8)}</div></div>
                                </div>
                            ))}
                        </div>
                    ) : activeTab === 'chats' ? (
                        chats.map(chat => (
                            <div key={chat.id} style={{ ...styles.chatItem, backgroundColor: selectedChatId === chat.id ? '#f0f2f5' : 'transparent' }} onClick={() => onSelectChat(chat)}>
                                <img src={chat.avatar_url || "https://ui-avatars.com/api/?name=" + (chat.name || 'C')} style={styles.chatAvatar} alt="" />
                                <div style={styles.chatInfo}>
                                    <div style={styles.chatHeader}><span style={styles.name}>{chat.name || 'Global Lobby'}</span></div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div style={styles.emptyTab}>No {activeTab} yet.</div>
                    )}
                </div>
            </div>
        </div>
    );
}

const styles: Record<string, React.CSSProperties> = {
    sidebar: { width: '450px', display: 'flex', backgroundColor: '#111b21', height: '100vh', borderRight: '1px solid #313d45' },
    verticalTabs: { width: '60px', backgroundColor: '#202c33', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '15px 0', gap: '20px', borderRight: '1px solid #313d45' },
    tabIcon: { fontSize: '24px', cursor: 'pointer', color: '#aebac1' },
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
    chatItem: { display: 'flex', padding: '12px 16px', gap: '12px', cursor: 'pointer', borderBottom: '1px solid #202c33' },
    chatAvatar: { width: '49px', height: '49px', borderRadius: '50%' },
    chatInfo: { flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' },
    chatHeader: { display: 'flex', justifyContent: 'space-between' },
    name: { fontWeight: '500', fontSize: '16px', color: '#e9edef' },
    time: { fontSize: '12px', color: '#8696a0' },
    emptyTab: { padding: '40px', textAlign: 'center', color: '#8696a0' }
};
