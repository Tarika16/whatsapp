import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';

interface ChatViewProps {
    chat: any;
    user: any;
}

export default function ChatView({ chat, user }: ChatViewProps) {
    const [messages, setMessages] = useState<any[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [showCall, setShowCall] = useState(false);
    const [callType, setCallType] = useState<'audio' | 'video'>('audio');
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!chat) return;
        fetchMessages();
        const channel = supabase
            .channel('public:messages:' + chat.id)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
                filter: `chat_id=eq.${chat.id}`
            }, (payload) => {
                setMessages((prev) => [...prev, payload.new]);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [chat]);

    useEffect(() => {
        scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const fetchMessages = async () => {
        const { data } = await supabase
            .from('messages')
            .select('*')
            .eq('chat_id', chat.id)
            .order('created_at', { ascending: true });
        if (data) setMessages(data);
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim()) return;
        const content = newMessage;
        setNewMessage('');
        const { error } = await supabase.from('messages').insert([
            { content, sender_id: user.id, chat_id: chat.id }
        ]);
        if (error) alert(error.message);
    };

    const initiateCall = (type: 'audio' | 'video') => {
        setCallType(type);
        setShowCall(true);
    };

    return (
        <div style={styles.chatView}>
            <div style={styles.header}>
                <div style={styles.chatMeta}>
                    <img src={chat.avatar_url || "https://ui-avatars.com/api/?name=" + (chat.name || 'C')} style={styles.avatar} alt="" />
                    <div style={styles.chatNameContainer}>
                        <div style={styles.chatName}>{chat.name || 'Global Lobby'}</div>
                        <div style={styles.chatStatus}>online</div>
                    </div>
                </div>
                <div style={styles.headerActions}>
                    <button style={styles.iconBtn} onClick={() => initiateCall('video')}>📹</button>
                    <button style={styles.iconBtn} onClick={() => initiateCall('audio')}>📞</button>
                    <button style={styles.iconBtn}>🔍</button>
                    <button style={styles.iconBtn}>⋮</button>
                </div>
            </div>

            <div style={styles.messageList}>
                <div style={styles.backgroundOverlay}></div>
                {messages.map((msg, index) => (
                    <div
                        key={msg.id || index}
                        style={{
                            ...(msg.sender_id === user.id ? styles.myMessage : styles.theirMessage),
                            animation: 'bounceIn 0.3s ease-out'
                        }}
                    >
                        <div style={styles.msgContent}>{msg.content}</div>
                        <div style={styles.msgTime}>
                            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                    </div>
                ))}
                <div ref={scrollRef}></div>
            </div>

            <style>{`
                @keyframes bounceIn {
                    0% { transform: scale(0.95); opacity: 0; }
                    80% { transform: scale(1.02); opacity: 1; }
                    100% { transform: scale(1); opacity: 1; }
                }
            `}</style>

            <form style={styles.inputArea} onSubmit={handleSendMessage}>
                <button type="button" style={styles.iconBtn}>😀</button>
                <button type="button" style={styles.iconBtn}>📎</button>
                <input
                    style={styles.textInput}
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message"
                />
                <button style={styles.sendButton} type="submit">
                    {newMessage.trim() ? "➤" : "🎤"}
                </button>
            </form>

            {showCall && (
                <div style={styles.callOverlay}>
                    <div style={styles.callCard}>
                        <img src={chat.avatar_url || "https://ui-avatars.com/api/?name=" + chat.name} style={styles.callAvatar} alt="" />
                        <h2>{chat.name}</h2>
                        <p>{callType.charAt(0).toUpperCase() + callType.slice(1)} Calling...</p>
                        <div style={styles.callActions}>
                            <button style={styles.endCallBtn} onClick={() => setShowCall(false)}>End Call</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

const styles: Record<string, React.CSSProperties> = {
    chatView: { flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#0b141a', position: 'relative' },
    header: { height: '60px', padding: '10px 16px', backgroundColor: '#202c33', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 },
    chatMeta: { display: 'flex', alignItems: 'center', gap: '15px' },
    avatar: { width: '40px', height: '40px', borderRadius: '50%' },
    chatNameContainer: { display: 'flex', flexDirection: 'column' },
    chatName: { fontWeight: 'bold', fontSize: '16px', color: '#e9edef' },
    chatStatus: { fontSize: '12px', color: '#8696a0' },
    headerActions: { display: 'flex', gap: '20px', marginRight: '5px' },
    iconBtn: { background: 'none', border: 'none', fontSize: '20px', color: '#aebac1', cursor: 'pointer' },
    messageList: { flex: 1, overflowY: 'auto', padding: '20px 7%', display: 'flex', flexDirection: 'column', gap: '12px', position: 'relative' },
    backgroundOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")', opacity: 0.04, pointerEvents: 'none', filter: 'invert(1)' },
    myMessage: { alignSelf: 'flex-end', backgroundColor: '#005c4b', padding: '6px 7px 8px 9px', borderRadius: '7.5px', maxWidth: '65%', boxShadow: '0 1px 0.5px rgba(0,0,0,0.13)', display: 'flex', flexDirection: 'column' },
    theirMessage: { alignSelf: 'flex-start', backgroundColor: '#202c33', padding: '6px 7px 8px 9px', borderRadius: '7.5px', maxWidth: '65%', boxShadow: '0 1px 0.5px rgba(0,0,0,0.13)', display: 'flex', flexDirection: 'column' },
    msgContent: { fontSize: '14.2px', color: '#e9edef', lineHeight: '19px' },
    msgTime: { fontSize: '11px', color: '#8696a0', alignSelf: 'flex-end', marginTop: '2px' },
    inputArea: { padding: '5px 10px', display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#202c33' },
    textInput: { flex: 1, padding: '9px 12px', borderRadius: '8px', border: 'none', outline: 'none', fontSize: '15px', backgroundColor: '#2a3942', color: '#e9edef' },
    sendButton: { width: '45px', height: '45px', backgroundColor: 'transparent', border: 'none', fontSize: '24px', color: '#aebac1', cursor: 'pointer' },
    callOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.95)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, color: 'white' },
    callCard: { textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' },
    callAvatar: { width: '120px', height: '120px', borderRadius: '50%', border: '4px solid #00a884' },
    callActions: { marginTop: '40px' },
    endCallBtn: { padding: '15px 30px', backgroundColor: '#ea0038', color: 'white', border: 'none', borderRadius: '30px', cursor: 'pointer', fontWeight: 'bold' }
};
