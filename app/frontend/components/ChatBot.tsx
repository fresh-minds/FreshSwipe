import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './ChatBot.module.css';

interface Message {
    id: string;
    role: 'user' | 'bot';
    content: string;
    timestamp: number;
}

interface ChatBotProps {
    isOpen: boolean;
    onClose: () => void;
}

export function ChatBot({ isOpen, onClose }: ChatBotProps) {
    const [messages, setMessages] = useState<Message[]>([
        {
            id: 'welcome',
            role: 'bot',
            content: "👋 Hi! I'm FreshBot. Ask me anything about your colleagues' skills, units, or availability!",
            timestamp: Date.now()
        }
    ]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isTyping, isOpen]);

    const handleSend = async () => {
        if (!input.trim()) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: input,
            timestamp: Date.now()
        };

        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsTyping(true);

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: userMessage.content })
            });

            if (!response.ok) throw new Error('Failed to get response');

            const data = await response.json();

            const botMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'bot',
                content: data.response,
                timestamp: Date.now()
            };

            setMessages(prev => [...prev, botMessage]);
        } catch (error) {
            console.error('Chat error:', error);
            const errorMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'bot',
                content: "Sorry, I'm having trouble connecting right now. Please try again later.",
                timestamp: Date.now()
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsTyping(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0, x: -20, scale: 0.95 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: -20, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className={styles.chatWindow}
                >
                    <div className={styles.header}>
                        <div className={styles.headerTitle}>
                            <span className={styles.robotIcon}>🤖</span>
                            FreshBot
                        </div>
                        <button
                            className={styles.closeButton}
                            onClick={onClose}
                            aria-label="Close chat"
                        >
                            ×
                        </button>
                    </div>

                    <div className={styles.messages}>
                        {messages.map((msg) => (
                            <div
                                key={msg.id}
                                className={`${styles.message} ${msg.role === 'user' ? styles.userMessage : styles.botMessage
                                    }`}
                            >
                                {msg.content}
                            </div>
                        ))}
                        {isTyping && (
                            <div className={styles.typingIndicator}>
                                <div className={styles.dot} />
                                <div className={styles.dot} />
                                <div className={styles.dot} />
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    <div className={styles.inputArea}>
                        <input
                            type="text"
                            className={styles.input}
                            placeholder="Ask about colleagues..."
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                            disabled={isTyping}
                        />
                        <button
                            className={styles.sendButton}
                            onClick={handleSend}
                            disabled={!input.trim() || isTyping}
                            aria-label="Send message"
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="22" y1="2" x2="11" y2="13"></line>
                                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                            </svg>
                        </button>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

