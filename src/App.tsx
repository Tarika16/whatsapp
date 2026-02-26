import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import Sidebar from './Sidebar';
import ChatView from './ChatView';

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [view, setView] = useState<'login' | 'chat'>('login');
  const [selectedChat, setSelectedChat] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) setView('chat');
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) setView('chat');
      else setView('login');
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignUp = async () => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) alert(error.message);
    else alert('Signup successful! You can now log in.');
  };

  const handleSignIn = async () => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert(error.message);
  };

  const handleDemoLogin = async () => {
    const demoEmail = 'demo@example.com';
    const demoPassword = 'demo123456';
    setEmail(demoEmail);
    setPassword(demoPassword);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: demoEmail,
      password: demoPassword
    });

    if (signInError) {
      // Try to sign up if login fails (likely user doesn't exist)
      const { error: signUpError } = await supabase.auth.signUp({
        email: demoEmail,
        password: demoPassword,
        options: { data: { name: 'Demo User' } }
      });

      if (signUpError) {
        alert("Demo login failed: " + signUpError.message);
      } else {
        // Sign up success, now sign in
        await supabase.auth.signInWithPassword({ email: demoEmail, password: demoPassword });
      }
    }
  };

  if (view === 'login') {
    return (
      <div style={styles.loginContainer}>
        <div style={styles.loginCard}>
          <h1 style={styles.title}>WhatsApp Web</h1>
          <p style={styles.subtitle}>Enter your details to start chatting</p>
          <input style={styles.input} type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input style={styles.input} type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <div style={styles.buttonGroup}>
            <button style={styles.primaryButton} onClick={handleSignIn}>Login</button>
            <button style={styles.secondaryButton} onClick={handleSignUp}>Sign Up</button>
          </div>
          <button
            style={{ ...styles.secondaryButton, width: '100%', marginTop: '15px', color: '#8696a0', borderColor: '#313d45' }}
            onClick={handleDemoLogin}
          >
            Try Demo Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.appContainer}>
      <div style={styles.topBar}></div>
      <div style={styles.mainContent}>
        <Sidebar
          onSelectChat={setSelectedChat}
          selectedChatId={selectedChat?.id}
          user={session.user}
        />
        {selectedChat ? (
          <ChatView chat={selectedChat} user={session.user} />
        ) : (
          <div style={styles.emptyState}>
            <div style={styles.emptyInner}>
              <div style={styles.emptyIcon}>💬</div>
              <h1 style={styles.emptyTitle}>WhatsApp Web</h1>
              <p style={styles.emptyText}>Send and receive messages without keeping your phone online.<br />Use WhatsApp on up to 4 linked devices and 1 phone at the same time.</p>
            </div>
            <div style={styles.encryptionInfo}>🔒 End-to-end encrypted</div>
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  appContainer: { height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column', backgroundColor: '#0c1317', overflow: 'hidden' },
  topBar: { height: '127px', backgroundColor: '#00a884', width: '100%', position: 'absolute', top: 0, zIndex: 0 },
  mainContent: { flex: 1, margin: '19px auto', width: 'calc(100% - 38px)', maxWidth: '1600px', display: 'flex', backgroundColor: '#111b21', borderRadius: '3px', boxShadow: '0 6px 18px rgba(0,0,0,0.4)', zIndex: 1, overflow: 'hidden' },
  loginContainer: { height: '100vh', width: '100vw', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#111b21' },
  loginCard: { backgroundColor: '#202c33', padding: '40px', borderRadius: '10px', boxShadow: '0 2px 10px rgba(0,0,0,0.3)', textAlign: 'center', width: '350px' },
  title: { color: '#00a884', fontSize: '28px', marginBottom: '10px' },
  subtitle: { color: '#aebac1', fontSize: '14px', marginBottom: '30px' },
  input: { width: '100%', padding: '12px', marginBottom: '15px', borderRadius: '5px', border: '1px solid #313d45', boxSizing: 'border-box', backgroundColor: '#2a3942', color: '#e9edef' },
  buttonGroup: { display: 'flex', gap: '10px', marginTop: '10px' },
  primaryButton: { flex: 1, padding: '12px', backgroundColor: '#00a884', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' },
  secondaryButton: { flex: 1, padding: '12px', backgroundColor: 'transparent', color: '#00a884', border: '1px solid #00a884', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' },
  emptyState: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#222e35', borderBottom: '6px solid #25d366' },
  emptyInner: { textAlign: 'center', padding: '0 20px' },
  emptyIcon: { fontSize: '80px', marginBottom: '20px', opacity: 0.5 },
  emptyTitle: { fontSize: '32px', fontWeight: '300', color: '#e9edef', marginBottom: '15px' },
  emptyText: { fontSize: '15px', color: '#8696a0', lineHeight: '22px' },
  encryptionInfo: { marginTop: '40px', fontSize: '14px', color: '#8696a0' }
};
